/** Deterministic sample data so the dashboard can be previewed without signing in. */
import { lastNDays } from "./dates";
import type { DashboardData, SleepNight, SleepSegment, Workout } from "./types";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function demoDashboard(rangeDays: number): DashboardData {
  const rand = rng(42);
  const dates = lastNDays(rangeDays);

  const days = dates.map((date, i) => {
    const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
    const steps = Math.round((weekend ? 11000 : 8200) + (rand() - 0.5) * 6000);
    return {
      date,
      steps,
      distanceKm: Math.round((steps * 0.00076) * 100) / 100,
      calories: Math.round(1950 + steps * 0.045 + rand() * 120),
      activeZoneMinutes: Math.round(Math.max(0, 18 + (rand() - 0.3) * 50)),
      // Slow drift downward with noise, like improving fitness.
      restingHeartRate: Math.round(62 - (i / rangeDays) * 3 + (rand() - 0.5) * 4),
    };
  });

  const sleep: SleepNight[] = dates.map((date) => {
    const deep = Math.round(60 + (rand() - 0.5) * 40);
    const rem = Math.round(90 + (rand() - 0.5) * 50);
    const light = Math.round(230 + (rand() - 0.5) * 80);
    const awake = Math.round(35 + rand() * 30);
    const end = new Date(`${date}T07:${String(Math.floor(rand() * 50)).padStart(2, "0")}:00`);
    const start = new Date(end.getTime() - (deep + rem + light + awake) * 60000);
    // Rough ~90 minute cycles: light -> deep -> light -> REM, with brief wakes.
    const segments: SleepSegment[] = [];
    let t = start.getTime();
    const push = (type: SleepSegment["type"], min: number) => {
      const next = Math.min(t + min * 60000, end.getTime());
      if (next > t) segments.push({ type, start: new Date(t).toISOString(), end: new Date(next).toISOString() });
      t = next;
    };
    push("awake", 8);
    for (let cycle = 0; t < end.getTime(); cycle++) {
      push("light", 20 + rand() * 25);
      push("deep", Math.max(4, 30 - cycle * 7 + rand() * 10));
      push("light", 10 + rand() * 15);
      push("rem", 8 + cycle * 6 + rand() * 10);
      if (rand() < 0.4) push("awake", 2 + rand() * 6);
    }
    const total = (type: SleepSegment["type"]) =>
      Math.round(
        segments
          .filter((x) => x.type === type)
          .reduce((sum, x) => sum + (Date.parse(x.end) - Date.parse(x.start)) / 60000, 0),
      );
    const totals = { deep: total("deep"), rem: total("rem"), light: total("light"), awake: total("awake") };
    return {
      date,
      segments,
      start: start.toISOString(),
      end: end.toISOString(),
      minutesAsleep: totals.deep + totals.rem + totals.light,
      minutesAwake: totals.awake,
      ...totals,
    };
  });

  const kinds = [
    { name: "Run", km: 5.2, min: 31, kcal: 410, hr: 152 },
    { name: "Walk", km: 3.4, min: 42, kcal: 190, hr: 104 },
    { name: "Bike", km: 14.8, min: 46, kcal: 380, hr: 131 },
    { name: "Weights", km: 0, min: 50, kcal: 240, hr: 112 },
  ];
  const workouts: Workout[] = dates
    .filter(() => rand() < 0.45)
    .map((date, i) => {
      const k = kinds[Math.floor(rand() * kinds.length)];
      const jitter = 0.85 + rand() * 0.3;
      return {
        id: `demo-${i}`,
        name: k.name,
        start: new Date(`${date}T18:${String(Math.floor(rand() * 59)).padStart(2, "0")}:00`).toISOString(),
        durationMinutes: Math.round(k.min * jitter),
        calories: Math.round(k.kcal * jitter),
        distanceKm: k.km ? Math.round(k.km * jitter * 100) / 100 : null,
        avgHeartRate: Math.round(k.hr + (rand() - 0.5) * 10),
        steps: k.name === "Run" || k.name === "Walk" ? Math.round(k.km * jitter * 1300) : null,
      };
    })
    .reverse();

  // Logged meals on most days; macros roughly 25/45/30 percent of calories.
  const nutritionDays = dates.map((date) => {
    if (rand() < 0.15) return { date, kcal: null, proteinG: null, carbsG: null, fatG: null };
    const kcal = Math.round(1900 + (rand() - 0.5) * 700);
    return {
      date,
      kcal,
      proteinG: Math.round((kcal * (0.22 + rand() * 0.08)) / 4),
      carbsG: Math.round((kcal * (0.42 + rand() * 0.08)) / 4),
      fatG: Math.round((kcal * (0.27 + rand() * 0.06)) / 9),
    };
  });

  return {
    rangeDays,
    days,
    sleep,
    workouts,
    errors: [],
    device: "Demo tracker",
    nutrition: { status: "ok", days: nutritionDays },
    demo: true,
  };
}
