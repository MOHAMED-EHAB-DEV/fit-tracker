/**
 * Chart colours and type, from the design tokens (docs/design/README.md,
 * "Data display").
 *
 * The colours are CSS variable references: SVG fill / stroke / stop-color
 * accept them, so a chart follows the light and dark theme without
 * re-rendering. Only code that needs the actual value (colour maths, canvas)
 * should call readChartColor.
 */

export const CHART_COLORS = {
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  ink3: "var(--ink-3)",
  line: "var(--line)",
  lineStrong: "var(--line-strong)",
  canvas: "var(--canvas)",
  surface: "var(--surface)",
  elevated: "var(--elevated)",
  /** Only for what is live: today's bar, the current value. */
  accent: "var(--accent)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  danger: "var(--danger)",
} as const;

export type ChartColor = keyof typeof CHART_COLORS;

/** Axis labels and values: Plex Mono 12px with tabular figures. */
export const CHART_FONT = {
  family: "var(--font-plex-mono), ui-monospace, monospace",
  size: 12,
} as const;

export const CHART_STROKE = {
  /** Data lines. */
  line: 1.75,
  /** Grid and baseline hairlines. */
  grid: 1,
  /** Target / goal lines are dashed. */
  targetDash: "3 3",
  gridDash: "2 3",
} as const;

const VARIABLE: Record<ChartColor, string> = {
  ink: "--ink",
  ink2: "--ink-2",
  ink3: "--ink-3",
  line: "--line",
  lineStrong: "--line-strong",
  canvas: "--canvas",
  surface: "--surface",
  elevated: "--elevated",
  accent: "--accent",
  ok: "--ok",
  warn: "--warn",
  danger: "--danger",
};

/** The colour currently on screen for a token ("" on the server). */
export function readChartColor(name: ChartColor): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(VARIABLE[name]).trim();
}
