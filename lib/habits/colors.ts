/**
 * Habit accent colours. Only 6-digit hex is stored, because the UI derives
 * tints by appending a hex alpha (`${color}18`), which is invalid for
 * rgb()/hsl()/named colours.
 */

export const DEFAULT_HABIT_COLOR = "#10b981";
export const DEFAULT_HABIT_EMOJI = "⚡";

export const HABIT_COLOR_PRESETS = [
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#ef4444", // red
  "#14b8a6", // teal
] as const;

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** "#abc" -> "#aabbcc", "#AABBCC" -> "#aabbcc"; anything else -> null. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return null;
}

/** A colour that is always safe to suffix with a hex alpha. */
export function safeHabitColor(value: unknown): string {
  return normalizeHexColor(value) ?? DEFAULT_HABIT_COLOR;
}
