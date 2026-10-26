"use client";

import { useSyncExternalStore } from "react";

/**
 * Data colors, stepped separately for each theme. Charts need concrete values
 * (SVG presentation attributes can't read CSS variables), so UI chrome lives in
 * globals.css and data hues live here.
 */
const LIGHT = {
  surface: "#ffffff",
  grid: "#f0f0f1",
  axis: "#a1a1aa",
  cursor: "#f4f4f5",
  move: "#0f9f74",
  moveSoft: "#0f9f7426",
  heart: "#e5484d",
  zone: "#e8890c",
  zoneSoft: "#e8890c26",
  deep: "#1d4ea6",
  rem: "#3b82f6",
  light: "#93c0f8",
  awake: "#d4d4d8",
  food: "#d6457f",
  protein: "#d6457f",
  carbs: "#e0a100",
  fat: "#4a3aa7",
};

const DARK: typeof LIGHT = {
  surface: "#141417",
  grid: "#222226",
  axis: "#63636b",
  cursor: "#1d1d21",
  move: "#2fc493",
  moveSoft: "#2fc4932b",
  heart: "#ff6b70",
  zone: "#f5a524",
  zoneSoft: "#f5a5242b",
  deep: "#3b6fd6",
  rem: "#5d9cf8",
  light: "#a9cdfa",
  awake: "#4a4a52",
  food: "#ee6a9c",
  protein: "#ee6a9c",
  carbs: "#d9a21b",
  fat: "#9085e9",
};

export type Palette = typeof LIGHT;

const query = "(prefers-color-scheme: dark)";
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePalette(): Palette {
  const dark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  return dark ? DARK : LIGHT;
}

export const STAGES = [
  { key: "awake", label: "Awake" },
  { key: "rem", label: "REM" },
  { key: "light", label: "Light" },
  { key: "deep", label: "Deep" },
] as const;
