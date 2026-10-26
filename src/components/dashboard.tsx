"use client";

import { SignOut, WarningCircle } from "@phosphor-icons/react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { average } from "@/lib/format";
import { SettingsProvider } from "@/lib/settings";
import type { DashboardData } from "@/lib/types";
import { HeartTrend, NutritionTrend, SleepTrend, StepsTrend, ZoneTrend } from "./charts";
import Footer from "./footer";
import { Segmented, staggerParent } from "./primitives";
import SettingsMenu from "./settings-menu";
import SleepCard from "./sleep-card";
import TodayCard from "./today-card";
import { HeartCard, ZoneCard } from "./vitals-cards";
import Workouts from "./workouts";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData; range: Range };

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard({ demo }: { demo: boolean }) {
  const [range, setRange] = useState<Range>(30);
  const [state, setState] = useState<State>({ status: "loading" });
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard?days=${range}${demo ? "&demo=1" : ""}`)
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 401) {
          // Session expired or revoked: send back to the sign-in screen.
          router.replace("/");
          router.refresh();
          return;
        }
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        if (!cancelled) setState({ status: "ready", data: body, range });
      })
      .catch((e) => !cancelled && setState({ status: "error", message: String(e.message ?? e) }));
    return () => {
      cancelled = true;
    };
  }, [range, demo, router]);

  const refreshing = state.status === "ready" && state.range !== range;
  const device = state.status === "ready" ? state.data.device : null;

  return (
    <SettingsProvider>
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 py-8 sm:px-6 md:py-12">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase" suppressHydrationWarning>
              <span className="text-primary">Wristside</span> ·{" "}
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-3xl font-semibold tracking-tighter md:text-4xl" suppressHydrationWarning>
              {greeting()}
            </h1>
            <p className="flex items-center gap-2 text-sm text-secondary">
              <span className={`pulse-dot relative inline-block size-1.5 rounded-full ${demo ? "text-zone" : "text-good"}`} style={{ background: "currentColor" }} />
              {demo ? "Demo data · not your account" : (device ?? "Google Health")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Segmented label="Date range" options={RANGES} value={range} onChange={setRange} format={(r) => `${r}D`} />
            <SettingsMenu />
            {demo ? (
              <Link
                href="/"
                className="card !rounded-full px-4 py-2 text-[13px] font-medium text-secondary transition hover:text-primary active:scale-[0.97]"
              >
                Exit demo
              </Link>
            ) : (
              <form action="/api/auth/logout" method="post">
                <button
                  aria-label="Sign out"
                  title="Sign out"
                  className="card grid size-10 place-items-center !rounded-full text-secondary transition hover:text-primary active:scale-95"
                >
                  <SignOut size={16} />
                </button>
              </form>
            )}
          </div>
        </header>

        {state.status === "loading" && <Skeleton />}
        {state.status === "error" && (
          <div role="alert" className="card flex items-start gap-3 p-6">
            <WarningCircle size={20} className="mt-0.5 shrink-0 text-bad" />
            <div>
              <p className="font-medium">Couldn&apos;t load your data</p>
              <p className="mt-1 text-sm text-secondary">{state.message}</p>
            </div>
          </div>
        )}
        {state.status === "ready" && (
          <div className={`transition-opacity duration-300 ${refreshing ? "opacity-60" : ""}`}>
            <Content key={state.range} data={state.data} />
          </div>
        )}
        <Footer />
      </main>
    </MotionConfig>
    </SettingsProvider>
  );
}

function Content({ data }: { data: DashboardData }) {
  const { days, sleep, workouts } = data;
  const reduce = useReducedMotion();
  return (
    <motion.div variants={staggerParent} initial={reduce ? false : "hidden"} animate="show" className="flex flex-col gap-10">
      {data.errors.length > 0 && (
        <details className="card px-6 py-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <WarningCircle size={16} className="text-bad" />
            Some data couldn&apos;t be loaded: {data.errors.map((e) => e.section).join(", ")}
          </summary>
          <ul className="mt-2 space-y-1 pl-6 text-secondary">
            {data.errors.map((e) => (
              <li key={e.section}>
                <span className="font-medium text-primary">{e.section}:</span> {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <section aria-label="Today" className="grid gap-4 lg:grid-cols-12">
        <div className="grid lg:col-span-5">
          <TodayCard today={days[days.length - 1]} avgSteps={average(days.map((d) => d.steps))} />
        </div>
        <div className="grid gap-4 lg:col-span-7 lg:grid-cols-7">
          <SleepCard sleep={sleep} />
          <HeartCard days={days} />
          <ZoneCard days={days} />
        </div>
      </section>

      <section aria-labelledby="trends" className="space-y-4">
        <h2 id="trends" className="px-1 text-lg font-semibold tracking-tight">
          Trends <span className="font-normal text-muted">· last {data.rangeDays} days</span>
        </h2>
        <div className="grid gap-4 lg:grid-cols-12">
          <StepsTrend days={days} />
          <SleepTrend sleep={sleep} />
          <HeartTrend days={days} />
          <ZoneTrend days={days} />
          <NutritionTrend nutrition={data.nutrition} days={days} />
          <Workouts workouts={workouts} />
        </div>
      </section>
    </motion.div>
  );
}

function Skeleton() {
  const block = "card shimmer";
  return (
    <div className="flex flex-col gap-10" aria-label="Loading" aria-busy>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className={`${block} h-[520px] lg:col-span-5`} />
        <div className="grid gap-4 lg:col-span-7 lg:grid-cols-7">
          <div className={`${block} h-[300px] lg:col-span-7`} />
          <div className={`${block} h-[204px] lg:col-span-4`} />
          <div className={`${block} h-[204px] lg:col-span-3`} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className={`${block} h-80 lg:col-span-7`} />
        <div className={`${block} h-80 lg:col-span-5`} />
      </div>
    </div>
  );
}
