import React from "react";

/** Neutral placeholder shared by every admin page (lists, forms and the dashboard). */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="w-full space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-3 rounded-card border border-line bg-surface p-4">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="skeleton h-11 w-full rounded-control" />
        ))}
      </div>
    </div>
  );
}
