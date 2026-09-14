/**
 * Computes a sort key for a time string in "HH:mm" (24h) format
 * ordering the planner day from 5:00 AM (05:00) through 12:00 AM (00:00) to 04:59 AM.
 *
 * 05:00 -> 0 (5:00 AM start of day)
 * 12:00 -> 420 (noon)
 * 23:59 -> 1139 (11:59 PM)
 * 00:00 -> 1140 (12:00 AM midnight)
 * 04:59 -> 1439 (late night cutoff before 5 AM)
 */
export function getPlannerTimeSortKey(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return ((hours - 5 + 24) % 24) * 60 + minutes;
}

export function comparePlannerTimes(timeA?: string, timeB?: string): number {
  return getPlannerTimeSortKey(timeA) - getPlannerTimeSortKey(timeB);
}

export function sortEventsByPlannerTime<T extends { startTime: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => comparePlannerTimes(a.startTime, b.startTime));
}
