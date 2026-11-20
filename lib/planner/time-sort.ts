/**
 * Planner day ordering. A planner day runs from 05:00 to 04:59 the next
 * morning, so late-night blocks (00:00-04:59) sort after 23:59.
 *
 * 05:00 -> 0, 12:00 -> 420, 23:59 -> 1139, 00:00 -> 1140, 04:59 -> 1439.
 * Unreadable times sort last (key 1440).
 */

export const PLANNER_DAY_START_HOUR = 5;
const INVALID_KEY = 24 * 60;

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const AMPM_RE = /^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])\.?\s*m\.?$/i;

/**
 * Normalises a time to "HH:MM" (24h). Accepts "7:30", "07:30", "7:30 PM",
 * "7pm". Returns null for anything else.
 */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;

  const plain = HHMM_RE.exec(text);
  if (plain) return `${plain[1].padStart(2, "0")}:${plain[2]}`;

  const ampm = AMPM_RE.exec(text);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === "p") hour += 12;
    return `${String(hour).padStart(2, "0")}:${ampm[2] || "00"}`;
  }
  return null;
}

export function getPlannerTimeSortKey(timeStr?: string | null): number {
  const normalized = normalizeTime(timeStr);
  if (!normalized) return INVALID_KEY;
  const [hours, minutes] = normalized.split(":").map(Number);
  return ((hours - PLANNER_DAY_START_HOUR + 24) % 24) * 60 + minutes;
}

export function comparePlannerTimes(timeA?: string | null, timeB?: string | null): number {
  return getPlannerTimeSortKey(timeA) - getPlannerTimeSortKey(timeB);
}

/** Stable sort by planner time, then by title. */
export function sortEventsByPlannerTime<T extends { startTime: string; title?: string }>(events: T[]): T[] {
  return [...events].sort(
    (a, b) =>
      comparePlannerTimes(a.startTime, b.startTime) ||
      String(a.title || "").localeCompare(String(b.title || ""))
  );
}

/** True when an end time falls after the start time within the planner day. */
export function isEndAfterStart(startTime: string, endTime: string): boolean {
  const start = getPlannerTimeSortKey(startTime);
  const end = getPlannerTimeSortKey(endTime);
  return start < INVALID_KEY && end < INVALID_KEY && end > start;
}

/**
 * Index in a time-sorted list where the "Now" marker belongs.
 * Between 00:00 and 04:59 the calendar day has just started and none of its
 * blocks (which start at 05:00) are past yet, so the marker goes first.
 */
export function nowMarkerIndex<T extends { startTime: string }>(events: T[], nowTime: string): number {
  const normalized = normalizeTime(nowTime);
  if (!normalized) return -1;
  const hour = Number(normalized.slice(0, 2));
  if (hour < PLANNER_DAY_START_HOUR) return 0;
  const nowKey = getPlannerTimeSortKey(normalized);
  let index = 0;
  while (index < events.length && getPlannerTimeSortKey(events[index].startTime) <= nowKey) index += 1;
  return index;
}
