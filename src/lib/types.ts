/** Normalized shapes the dashboard renders, independent of the API's wire format. */

export type DailyActivity = {
  date: string; // YYYY-MM-DD, user's local calendar day
  steps: number | null;
  distanceKm: number | null;
  calories: number | null;
  activeZoneMinutes: number | null;
  restingHeartRate: number | null;
};

export type SleepStageType = "deep" | "rem" | "light" | "awake";

export type SleepSegment = { type: SleepStageType; start: string; end: string };

export type SleepNight = {
  date: string; // day the sleep ended (the "night of" label is the morning)
  start: string; // ISO
  end: string; // ISO
  minutesAsleep: number;
  minutesAwake: number;
  deep: number;
  light: number;
  rem: number;
  awake: number;
  /** Ordered stage segments for the hypnogram (empty when not available). */
  segments: SleepSegment[];
};

export type Workout = {
  id: string;
  name: string;
  start: string; // ISO
  durationMinutes: number;
  calories: number | null;
  distanceKm: number | null;
  avgHeartRate: number | null;
  steps: number | null;
};

export type NutritionDay = {
  date: string;
  kcal: number | null; // calories eaten
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type DashboardData = {
  rangeDays: number;
  days: DailyActivity[];
  sleep: SleepNight[];
  workouts: Workout[];
  /** Per-section errors so one failing data type doesn't blank the whole page. */
  errors: { section: string; message: string }[];
  /** Display name of the tracker that recorded the data, e.g. "Google Fitbit Air". */
  device: string | null;
  /** "no-access" when the session predates the nutrition permission; reconnecting fixes it. */
  nutrition: { status: "ok" | "no-access"; days: NutritionDay[] };
  demo: boolean;
};
