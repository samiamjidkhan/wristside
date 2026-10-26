"use client";

import { ArrowsClockwise, BowlFood, ChartBar, Table } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { average, fmtDay, fmtHM, fmtNum } from "@/lib/format";
import { STAGES, usePalette, type Palette } from "@/lib/palette";
import { useDistance, useSettings } from "@/lib/settings";
import type { DailyActivity, DashboardData, SleepNight } from "@/lib/types";
import { Card, EmptyState, LegendKey, TooltipBox } from "./primitives";

function TrendCard({
  title,
  summary,
  legend,
  table,
  className = "",
  bodyClassName = "h-56",
  children,
}: {
  title: string;
  summary: ReactNode;
  legend?: ReactNode;
  table: { head: string[]; rows: (string | number)[][] };
  className?: string;
  /** Height/layout of the chart body; the table view keeps a fixed height. */
  bodyClassName?: string;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={`flex flex-col gap-4 p-6 md:p-7 ${className}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-[13px] font-medium text-secondary">{title}</h3>
          <div className="tabular text-2xl font-semibold tracking-tight">{summary}</div>
        </div>
        <button
          onClick={() => setShowTable((s) => !s)}
          aria-pressed={showTable}
          aria-label={showTable ? "Show chart" : "Show table"}
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-primary active:scale-95"
        >
          {showTable ? <ChartBar size={16} /> : <Table size={16} />}
        </button>
      </header>
      {legend}
      {showTable ? (
        <div className="h-56 overflow-auto text-sm">
          <table className="tabular w-full">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr>
                {table.head.map((h) => (
                  <th key={h} className="py-1.5 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...table.rows].reverse().map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className="py-1.5 pr-4">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`w-full ${bodyClassName}`}>{children}</div>
      )}
    </Card>
  );
}

const axis = (c: Palette) => ({
  tick: { fill: c.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

const xAxis = (c: Palette) => (
  <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={28} tickMargin={8} {...axis(c)} />
);

export function StepsTrend({ days }: { days: DailyActivity[] }) {
  const c = usePalette();
  const reduce = useReducedMotion();
  const { stepGoal: STEP_GOAL } = useSettings();
  const dist = useDistance();
  const avg = average(days.map((d) => d.steps));
  const met = days.filter((d) => (d.steps ?? 0) >= STEP_GOAL).length;
  const top = Math.max(STEP_GOAL, ...days.map((d) => d.steps ?? 0));
  const ticks = Array.from({ length: Math.ceil(top / 5000) + 1 }, (_, i) => i * 5000);

  return (
    <TrendCard
      title="Steps"
      summary={
        <>
          {fmtNum(avg)} <span className="text-sm font-normal text-muted">avg / day</span>
        </>
      }
      legend={
        <LegendKey
          items={[
            { color: c.move, label: "Goal met", value: `${met} days` },
            { color: c.moveSoft, label: `Below ${fmtNum(STEP_GOAL)}` },
          ]}
        />
      }
      table={{
        head: ["Date", "Steps", "Distance"],
        rows: days.map((d) => [fmtDay(d.date), fmtNum(d.steps), dist.label(d.distanceKm)]),
      }}
      className="lg:col-span-7"
    >
      <ResponsiveContainer>
        <BarChart data={days} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          {xAxis(c)}
          <YAxis
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tickFormatter={(v) => (v ? `${v / 1000}k` : "0")}
            width={44}
            {...axis(c)}
          />
          <ReferenceLine y={STEP_GOAL} stroke={c.axis} strokeOpacity={0.6} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={fmtDay(payload[0].payload.date)}
                  rows={[
                    { color: c.move, label: "Steps", value: fmtNum(payload[0].payload.steps) },
                    { label: "Distance", value: dist.label(payload[0].payload.distanceKm) },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="steps" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={700}>
            {days.map((d) => (
              <Cell key={d.date} fill={(d.steps ?? 0) >= STEP_GOAL ? c.move : c.moveSoft} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}

export function SleepTrend({ sleep }: { sleep: SleepNight[] }) {
  const c = usePalette();
  const reduce = useReducedMotion();
  const avg = average(sleep.map((n) => n.minutesAsleep));
  const stack = ["deep", "rem", "light", "awake"] as const;
  const data = sleep.map((n) => ({ ...n, ...Object.fromEntries(stack.map((k) => [`${k}H`, n[k] / 60])) }));

  return (
    <TrendCard
      title="Sleep"
      summary={
        <>
          {fmtHM(avg)} <span className="text-sm font-normal text-muted">avg asleep</span>
        </>
      }
      legend={<LegendKey items={stack.map((k) => ({ color: c[k], label: STAGES.find((s) => s.key === k)!.label }))} />}
      table={{
        head: ["Night ending", "Asleep", "Deep", "REM", "Light", "Awake"],
        rows: sleep.map((n) => [fmtDay(n.date), fmtHM(n.minutesAsleep), fmtHM(n.deep), fmtHM(n.rem), fmtHM(n.light), fmtHM(n.awake)]),
      }}
      className="lg:col-span-5"
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          {xAxis(c)}
          <YAxis tickFormatter={(v) => `${v}h`} width={44} allowDecimals={false} {...axis(c)} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const n = payload[0].payload as SleepNight;
              return (
                <TooltipBox
                  title={`${fmtDay(n.date)} · ${fmtHM(n.minutesAsleep)} asleep`}
                  rows={stack.map((k) => ({ color: c[k], label: STAGES.find((s) => s.key === k)!.label, value: fmtHM(n[k]) }))}
                />
              );
            }}
          />
          {stack.map((k, i) => (
            <Bar
              key={k}
              dataKey={`${k}H`}
              stackId="sleep"
              fill={c[k]}
              stroke={c.surface}
              strokeWidth={1}
              maxBarSize={22}
              radius={i === stack.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={!reduce} animationDuration={700}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}

export function HeartTrend({ days }: { days: DailyActivity[] }) {
  const c = usePalette();
  const reduce = useReducedMotion();
  const values = days.map((d) => d.restingHeartRate).filter((v): v is number => v !== null);
  const min = values.length ? Math.min(...values) : 50;
  const max = values.length ? Math.max(...values) : 70;
  const avg = average(values);

  return (
    <TrendCard
      title="Resting heart rate"
      summary={
        <>
          {avg ? avg.toFixed(1) : "–"} <span className="text-sm font-normal text-muted">bpm avg</span>
        </>
      }
      table={{ head: ["Date", "Resting HR"], rows: days.map((d) => [fmtDay(d.date), d.restingHeartRate ? `${d.restingHeartRate} bpm` : "–"]) }}
      className="lg:col-span-5"
    >
      <ResponsiveContainer>
        <AreaChart data={days} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="hr-trend-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.heart} stopOpacity={0.18} />
              <stop offset="100%" stopColor={c.heart} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} />
          {xAxis(c)}
          <YAxis domain={[min - 3, max + 3]} allowDecimals={false} width={44} {...axis(c)} />
          <Tooltip
            cursor={{ stroke: c.axis, strokeWidth: 1 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={fmtDay(payload[0].payload.date)}
                  rows={[{ color: c.heart, label: "Resting HR", value: payload[0].payload.restingHeartRate ? `${payload[0].payload.restingHeartRate} bpm` : "–" }]}
                />
              ) : null
            }
          />
          <Area
            dataKey="restingHeartRate"
            type="monotone"
            stroke={c.heart}
            strokeWidth={2}
            fill="url(#hr-trend-wash)"
            dot={false}
            activeDot={{ r: 4.5, fill: c.heart, stroke: c.surface, strokeWidth: 2 }}
            connectNulls
            isAnimationActive={!reduce} animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}

export function ZoneTrend({ days }: { days: DailyActivity[] }) {
  const c = usePalette();
  const reduce = useReducedMotion();
  const { weeklyZoneGoal } = useSettings();
  const total = days.reduce((s, d) => s + (d.activeZoneMinutes ?? 0), 0);
  const perWeek = total / Math.max(1, days.length / 7);

  return (
    <TrendCard
      title="Active Zone Minutes"
      summary={
        <>
          {fmtNum(perWeek)} <span className="text-sm font-normal text-muted">per week · goal {weeklyZoneGoal}</span>
        </>
      }
      table={{
        head: ["Date", "Zone min", "Calories"],
        rows: days.map((d) => [fmtDay(d.date), fmtNum(d.activeZoneMinutes), d.calories ? `${fmtNum(d.calories)} kcal` : "–"]),
      }}
      className="lg:col-span-7"
    >
      <ResponsiveContainer>
        <BarChart data={days} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          {xAxis(c)}
          <YAxis width={44} allowDecimals={false} {...axis(c)} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={fmtDay(payload[0].payload.date)}
                  rows={[
                    { color: c.zone, label: "Zone minutes", value: fmtNum(payload[0].payload.activeZoneMinutes) },
                    { label: "Calories", value: payload[0].payload.calories ? `${fmtNum(payload[0].payload.calories)} kcal` : "–" },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="activeZoneMinutes" fill={c.zone} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}

// Energy per gram of each macronutrient, for the share-of-calories split.
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;
const MACROS = [
  { key: "protein", label: "Protein", field: "proteinG" },
  { key: "carbs", label: "Carbs", field: "carbsG" },
  { key: "fat", label: "Fat", field: "fatG" },
] as const;

export function NutritionTrend({ nutrition, days }: { nutrition: DashboardData["nutrition"]; days: DailyActivity[] }) {
  const c = usePalette();
  const reduce = useReducedMotion();
  const data = nutrition.days.map((n, i) => ({ ...n, burned: days[i]?.calories ?? null }));
  const logged = data.filter((d) => d.kcal !== null);
  const avgIn = average(logged.map((d) => d.kcal));
  // Compare against burn on the same days only, so unlogged days don't skew the balance.
  const avgOut = average(logged.map((d) => d.burned));
  const grams = Object.fromEntries(
    MACROS.map((m) => [m.key, average(logged.map((d) => d[m.field])) ?? 0]),
  ) as Record<(typeof MACROS)[number]["key"], number>;
  const macroKcal = MACROS.reduce((s, m) => s + grams[m.key] * KCAL_PER_G[m.key], 0) || 1;

  if (nutrition.status === "no-access" || logged.length === 0) {
    return (
      <Card className="p-6 md:p-7 lg:col-span-12">
        <h3 className="text-[13px] font-medium text-secondary">Nutrition</h3>
        {nutrition.status === "no-access" ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <EmptyState
              icon={BowlFood}
              title="Reconnect to see nutrition"
              body="Wristside can now show the calories and macros you log in the Google Health app. Reconnect once to allow it."
            />
            <a
              href="/api/auth/login"
              className="mb-6 flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-ink-contrast transition hover:opacity-90 active:scale-[0.98]"
            >
              <ArrowsClockwise size={14} />
              Reconnect Google Health
            </a>
          </div>
        ) : (
          <EmptyState
            icon={BowlFood}
            title="No food logged in this period"
            body="Log meals in the Google Health app and your calories and macros will show up here."
          />
        )}
      </Card>
    );
  }

  return (
    <TrendCard
      title="Nutrition"
      summary={
        <>
          {fmtNum(avgIn)} <span className="text-sm font-normal text-muted">kcal eaten / day</span>
          {avgOut !== null && avgIn !== null && (
            <span className="ml-2 text-sm font-normal text-muted">
              · {fmtNum(Math.abs(avgOut - avgIn))} kcal {avgOut >= avgIn ? "deficit" : "surplus"}
            </span>
          )}
        </>
      }
      legend={
        <LegendKey
          items={[
            { color: c.food, label: "Eaten", value: `${logged.length} days logged` },
            { color: c.axis, label: "Burned" },
          ]}
        />
      }
      table={{
        head: ["Date", "Eaten", "Burned", "Protein", "Carbs", "Fat"],
        rows: data.map((d) => [
          fmtDay(d.date),
          d.kcal === null ? "–" : `${fmtNum(d.kcal)} kcal`,
          d.burned === null ? "–" : `${fmtNum(d.burned)} kcal`,
          d.proteinG === null ? "–" : `${d.proteinG} g`,
          d.carbsG === null ? "–" : `${d.carbsG} g`,
          d.fatG === null ? "–" : `${d.fatG} g`,
        ]),
      }}
      className="lg:col-span-12"
      bodyClassName="grid gap-6 lg:grid-cols-[1fr_280px]"
    >
      <div className="h-56 min-w-0">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            {xAxis(c)}
            <YAxis width={44} allowDecimals={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} {...axis(c)} />
            <Tooltip
              cursor={{ fill: c.cursor }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={fmtDay(d.date)}
                    rows={[
                      { color: c.food, label: "Eaten", value: d.kcal === null ? "Not logged" : `${fmtNum(d.kcal)} kcal` },
                      { color: c.axis, label: "Burned", value: d.burned === null ? "–" : `${fmtNum(d.burned)} kcal` },
                      ...MACROS.map((m) => ({
                        color: c[m.key],
                        label: m.label,
                        value: d[m.field] === null ? "–" : `${d[m.field]} g`,
                      })),
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="kcal" fill={c.food} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reduce} animationDuration={700} />
            <Line
              dataKey="burned"
              type="monotone"
              stroke={c.axis}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={!reduce}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col justify-center gap-4 rounded-2xl bg-surface-2 p-5">
        <p className="text-xs text-muted">Average macros on logged days</p>
        <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Share of calories by macronutrient">
          {MACROS.map((m) => (
            <div
              key={m.key}
              style={{ flexGrow: (grams[m.key] * KCAL_PER_G[m.key]) / macroKcal, flexBasis: 0, background: c[m.key] }}
            />
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {MACROS.map((m) => (
            <div key={m.key}>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-full" style={{ background: c[m.key] }} />
                {m.label}
              </dt>
              <dd className="tabular mt-0.5 text-lg font-semibold tracking-tight">
                {fmtNum(grams[m.key])}
                <span className="ml-0.5 text-xs font-normal text-muted">g</span>
              </dd>
              <dd className="tabular text-xs text-muted">
                {Math.round(((grams[m.key] * KCAL_PER_G[m.key]) / macroKcal) * 100)}% of kcal
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </TrendCard>
  );
}
