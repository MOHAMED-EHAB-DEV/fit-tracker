/**
 * Client-side freshness flags for server-rendered pages (module state, so it
 * lives for the life of the SPA tab).
 *
 * The client router cache can show an old dashboard after Back/forward
 * navigation. Any mutation that changes dashboard numbers calls
 * `markDashboardStale()`; dashboard widgets call `consumeDashboardStale()` on
 * mount and refresh the route when it returns true.
 */

let dashboardStale = false;
let lastRefreshAt = 0;

/** Call after a write that changes what the dashboard shows. */
export function markDashboardStale(): void {
  dashboardStale = true;
}

/** True once per mark; clears the flag. */
export function consumeDashboardStale(): boolean {
  const value = dashboardStale;
  dashboardStale = false;
  return value;
}

/**
 * Throttles route refreshes requested by several widgets for the same event
 * (day change, app resume). Returns true when the caller should refresh.
 */
export function claimRefresh(now: number = Date.now(), minIntervalMs: number = 2_000): boolean {
  if (now - lastRefreshAt < minIntervalMs) return false;
  lastRefreshAt = now;
  return true;
}
