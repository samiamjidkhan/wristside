/**
 * Thin client for the Google Health API (v4).
 * Reference: https://developers.google.com/health/reference/rest
 */
import { addDays, civilDate, lastNDays } from "./dates";
import type {
  DailyActivity,
  DashboardData,
  NutritionDay,
  SleepNight,
  SleepStageType,
  Workout,
} from "./types";

const BASE = "https://health.googleapis.com/v4/users/me/dataTypes";

type CivilDate = { year?: number; month?: number; day?: number };
type CivilDateTime = { date?: CivilDate };

// Only the wire fields we read. int64 values arrive as strings.
type RollupPoint = {
  civilStartTime?: CivilDateTime;
  steps?: { countSum?: string };
  distance?: { millimetersSum?: string };
  totalCalories?: { kcalSum?: number };
  nutritionLog?: {
    energy?: { kcalSum?: number };
    totalCarbohydrate?: { gramsSum?: number };
    totalFat?: { gramsSum?: number };
    nutrients?: { nutrient?: string; quantity?: { gramsSum?: number } }[];
  };
  activeZoneMinutes?: {
    sumInFatBurnHeartZone?: string;
    sumInCardioHeartZone?: string;
    sumInPeakHeartZone?: string;
  };
};

type SessionInterval = {
  startTime?: string;
  endTime?: string;
  endUtcOffset?: string; // e.g. "18000s"
  civilStartTime?: CivilDateTime;
  civilEndTime?: CivilDateTime;
};

type DataPoint = {
  name?: string;
  dataSource?: { device?: { displayName?: string } };
  dailyRestingHeartRate?: { date?: CivilDate; beatsPerMinute?: string };
  sleep?: {
    interval?: SessionInterval;
    metadata?: { mainSleep?: boolean; nap?: boolean };
    stages?: { type?: string; startTime?: string; endTime?: string }[];
    summary?: {
      minutesAsleep?: string;
      minutesAwake?: string;
      stagesSummary?: { type?: string; minutes?: string }[];
    };
  };
  exercise?: {
    displayName?: string;
    exerciseType?: string;
    interval?: SessionInterval;
    activeDuration?: string; // e.g. "1830s"
    metricsSummary?: {
      caloriesKcal?: number;
      distanceMillimeters?: number;
      averageHeartRateBeatsPerMinute?: string;
      steps?: string;
    };
  };
};

export class HealthApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
    if (res.ok) return res.json() as Promise<T>;

    // Retry transient server errors with a short backoff.
    if ((res.status === 503 || res.status === 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }

    const text = await res.text();
    console.error(`[health-api] ${init?.method ?? "GET"} ${url} -> ${res.status}`, init?.body ?? "", text);
    let message = `${res.status} ${res.statusText}`;
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {}
    throw new HealthApiError(message, res.status);
  }
}

function civil(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { date: { year, month, day } };
}

// Some data types cap a single rollup request at 14 days; everything else at 90.
const MAX_ROLLUP_DAYS: Record<string, number> = {
  "total-calories": 14,
  "heart-rate": 14,
  "active-minutes": 14,
  "calories-in-heart-rate-zone": 14,
};

/** POST :dailyRollUp for one data type over [startDate, endDate), chunked to the API's max range. */
async function dailyRollUp(token: string, dataType: string, startDate: string, endDate: string) {
  const maxDays = MAX_ROLLUP_DAYS[dataType] ?? 90;
  const chunks: [string, string][] = [];
  for (let from = startDate; from < endDate; from = addDays(from, maxDays)) {
    const to = addDays(from, maxDays);
    chunks.push([from, to < endDate ? to : endDate]);
  }
  const results = await Promise.all(
    chunks.map(([from, to]) => dailyRollUpRange(token, dataType, from, to)),
  );
  return results.flat();
}

async function dailyRollUpRange(token: string, dataType: string, startDate: string, endDate: string) {
  const points: RollupPoint[] = [];
  let pageToken: string | undefined;
  do {
    const res = await call<{ rollupDataPoints?: RollupPoint[]; nextPageToken?: string }>(
      token,
      `${BASE}/${dataType}/dataPoints:dailyRollUp`,
      {
        method: "POST",
        body: JSON.stringify({
          range: { start: civil(startDate), end: civil(endDate) },
          windowSizeDays: 1,
          pageToken,
        }),
      },
    );
    points.push(...(res.rollupDataPoints ?? []));
    pageToken = res.nextPageToken || undefined;
  } while (pageToken);
  return points;
}

// `sleep` and `exercise` reject page sizes above 25.
const MAX_PAGE_SIZE: Record<string, number> = { sleep: 25, exercise: 25 };

/** GET dataPoints with an AIP-160 filter, following pagination. */
async function listPoints(token: string, dataType: string, filter: string, maxPages = 20) {
  const points: DataPoint[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const params = new URLSearchParams({ filter, pageSize: String(MAX_PAGE_SIZE[dataType] ?? 1000) });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await call<{ dataPoints?: DataPoint[]; nextPageToken?: string }>(
      token,
      `${BASE}/${dataType}/dataPoints?${params}`,
    );
    points.push(...(res.dataPoints ?? []));
    pageToken = res.nextPageToken || undefined;
  } while (pageToken && ++pages < maxPages);
  return points;
}

const num = (v: string | number | undefined) => (v === undefined || v === null ? null : Number(v));

function byDate(points: RollupPoint[], pick: (p: RollupPoint) => number | null) {
  const map = new Map<string, number | null>();
  for (const p of points) {
    const date = civilDate(p.civilStartTime?.date);
    if (date) map.set(date, pick(p));
  }
  return map;
}

const SEGMENT_TYPE: Record<string, SleepStageType> = {
  DEEP: "deep",
  REM: "rem",
  LIGHT: "light",
  ASLEEP: "light",
  AWAKE: "awake",
  RESTLESS: "awake",
};

/** Local calendar date of a UTC timestamp, given the API's "<seconds>s" UTC offset. */
function localDate(utc: string, offset?: string) {
  const shifted = new Date(Date.parse(utc) + (parseFloat(offset ?? "0") || 0) * 1000);
  return shifted.toISOString().slice(0, 10);
}

function parseSleep(points: DataPoint[]): SleepNight[] {
  const nights = new Map<string, SleepNight>();
  for (const p of points) {
    const s = p.sleep;
    const end = s?.interval?.endTime;
    if (!s || !s.interval?.startTime || !end) continue;
    if (s.metadata?.nap) continue;
    // civilEndTime is documented but not always present; fall back to endTime + offset.
    const date = civilDate(s.interval.civilEndTime?.date) ?? localDate(end, s.interval.endUtcOffset);

    // Minutes per stage type, from the summary when present, else summed from the segments.
    const minutes = new Map<string, number>();
    if (s.summary?.stagesSummary?.length) {
      for (const x of s.summary.stagesSummary) {
        if (x.type) minutes.set(x.type, (minutes.get(x.type) ?? 0) + Number(x.minutes ?? 0));
      }
    } else {
      for (const x of s.stages ?? []) {
        if (!x.type || !x.startTime || !x.endTime) continue;
        const m = (Date.parse(x.endTime) - Date.parse(x.startTime)) / 60000;
        minutes.set(x.type, (minutes.get(x.type) ?? 0) + m);
      }
    }
    const stage = (...types: string[]) =>
      Math.round(types.reduce((sum, t) => sum + (minutes.get(t) ?? 0), 0));

    const deep = stage("DEEP");
    const rem = stage("REM");
    // Classic (non-staged) sleep reports ASLEEP/RESTLESS instead of stages.
    const light = stage("LIGHT", "ASLEEP");
    const awake = stage("AWAKE", "RESTLESS");
    const night: SleepNight = {
      date,
      start: s.interval.startTime,
      end,
      minutesAsleep: s.summary?.minutesAsleep ? Number(s.summary.minutesAsleep) : deep + rem + light,
      minutesAwake: s.summary?.minutesAwake ? Number(s.summary.minutesAwake) : awake,
      deep,
      rem,
      light,
      awake,
      segments: (s.stages ?? [])
        .filter((x) => x.type && SEGMENT_TYPE[x.type] && x.startTime && x.endTime)
        .map((x) => ({ type: SEGMENT_TYPE[x.type!], start: x.startTime!, end: x.endTime! }))
        .sort((a, b) => a.start.localeCompare(b.start)),
    };
    // Keep the main (longest) sleep per day.
    const existing = nights.get(date);
    if (!existing || s.metadata?.mainSleep || night.minutesAsleep > existing.minutesAsleep) {
      nights.set(date, night);
    }
  }
  return [...nights.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function parseWorkouts(points: DataPoint[]): Workout[] {
  return points
    .filter((p) => p.exercise?.interval?.startTime)
    .map((p, i) => {
      const e = p.exercise!;
      const start = e.interval!.startTime!;
      const wall =
        e.interval?.endTime ? (Date.parse(e.interval.endTime) - Date.parse(start)) / 60000 : 0;
      const active = e.activeDuration ? parseFloat(e.activeDuration) / 60 : wall;
      const mm = e.metricsSummary?.distanceMillimeters;
      return {
        id: p.name ?? `${start}-${i}`,
        name: e.displayName ?? e.exerciseType ?? "Workout",
        start,
        durationMinutes: Math.round(active),
        calories: e.metricsSummary?.caloriesKcal ? Math.round(e.metricsSummary.caloriesKcal) : null,
        distanceKm: mm ? mm / 1_000_000 : null,
        avgHeartRate: num(e.metricsSummary?.averageHeartRateBeatsPerMinute),
        steps: num(e.metricsSummary?.steps),
      };
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}

export async function fetchDashboard(token: string, rangeDays: number): Promise<DashboardData> {
  const dates = lastNDays(rangeDays);
  const start = dates[0];
  const endExclusive = addDays(dates[dates.length - 1], 1);
  const errors: DashboardData["errors"] = [];

  const settle = async <T>(section: string, p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      errors.push({ section, message: e instanceof Error ? e.message : String(e) });
      return fallback;
    }
  };

  // Nutrition needs its own permission; sessions created before it was added get a 403.
  let nutritionStatus: DashboardData["nutrition"]["status"] = "ok";
  const nutritionPromise = dailyRollUp(token, "nutrition-log", start, endExclusive).catch((e) => {
    if (e instanceof HealthApiError && e.status === 403) nutritionStatus = "no-access";
    else errors.push({ section: "Nutrition", message: e instanceof Error ? e.message : String(e) });
    return [] as RollupPoint[];
  });

  const [steps, distance, calories, azm, rhr, sleep, exercise, nutrition] = await Promise.all([
    settle("Steps", dailyRollUp(token, "steps", start, endExclusive), []),
    settle("Distance", dailyRollUp(token, "distance", start, endExclusive), []),
    settle("Calories", dailyRollUp(token, "total-calories", start, endExclusive), []),
    settle("Active zone minutes", dailyRollUp(token, "active-zone-minutes", start, endExclusive), []),
    settle(
      "Resting heart rate",
      listPoints(
        token,
        "daily-resting-heart-rate",
        `daily_resting_heart_rate.date >= "${start}" AND daily_resting_heart_rate.date < "${endExclusive}"`,
      ),
      [],
    ),
    settle(
      "Sleep",
      listPoints(
        token,
        "sleep",
        `sleep.interval.civil_end_time >= "${start}" AND sleep.interval.civil_end_time < "${endExclusive}"`,
      ),
      [],
    ),
    settle(
      "Workouts",
      listPoints(
        token,
        "exercise",
        `exercise.interval.civil_start_time >= "${start}" AND exercise.interval.civil_start_time < "${endExclusive}"`,
      ),
      [],
    ),
    nutritionPromise,
  ]);

  const stepsBy = byDate(steps, (p) => num(p.steps?.countSum));
  const distBy = byDate(distance, (p) => {
    const mm = num(p.distance?.millimetersSum);
    return mm === null ? null : mm / 1_000_000;
  });
  const calBy = byDate(calories, (p) => {
    const k = p.totalCalories?.kcalSum;
    return k === undefined ? null : Math.round(k);
  });
  const azmBy = byDate(azm, (p) => {
    const z = p.activeZoneMinutes;
    if (!z) return null;
    // Values are already AZM (cardio/peak minutes are pre-doubled by the API).
    return (
      Number(z.sumInFatBurnHeartZone ?? 0) +
      Number(z.sumInCardioHeartZone ?? 0) +
      Number(z.sumInPeakHeartZone ?? 0)
    );
  });
  const rhrBy = new Map<string, number | null>();
  for (const p of rhr) {
    const date = civilDate(p.dailyRestingHeartRate?.date);
    if (date) rhrBy.set(date, num(p.dailyRestingHeartRate?.beatsPerMinute));
  }

  const days: DailyActivity[] = dates.map((date) => ({
    date,
    steps: stepsBy.get(date) ?? null,
    distanceKm: distBy.get(date) ?? null,
    calories: calBy.get(date) ?? null,
    activeZoneMinutes: azmBy.get(date) ?? null,
    restingHeartRate: rhrBy.get(date) ?? null,
  }));

  const nutritionBy = new Map<string, NutritionDay>();
  for (const p of nutrition) {
    const date = civilDate(p.civilStartTime?.date);
    const n = p.nutritionLog;
    if (!date || !n) continue;
    const protein = n.nutrients?.find((x) => x.nutrient === "PROTEIN")?.quantity?.gramsSum;
    nutritionBy.set(date, {
      date,
      kcal: n.energy?.kcalSum === undefined ? null : Math.round(n.energy.kcalSum),
      proteinG: protein === undefined ? null : Math.round(protein),
      carbsG: n.totalCarbohydrate?.gramsSum === undefined ? null : Math.round(n.totalCarbohydrate.gramsSum),
      fatG: n.totalFat?.gramsSum === undefined ? null : Math.round(n.totalFat.gramsSum),
    });
  }
  const nutritionDays: NutritionDay[] = dates.map(
    (date) => nutritionBy.get(date) ?? { date, kcal: null, proteinG: null, carbsG: null, fatG: null },
  );

  // Most recent tracker name seen on session data (newest first from the API).
  const device =
    [...sleep, ...exercise].map((p) => p.dataSource?.device?.displayName).find(Boolean) ?? null;

  return {
    rangeDays,
    days,
    sleep: parseSleep(sleep),
    workouts: parseWorkouts(exercise),
    errors,
    device,
    nutrition: { status: nutritionStatus, days: nutritionDays },
    demo: false,
  };
}
