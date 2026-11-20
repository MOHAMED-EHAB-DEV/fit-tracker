import React from "react";

/** Neutral placeholder shared by every admin page (lists, forms and the dashboard). */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6 w-full animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <div className="h-7 w-48 bg-zinc-800 rounded-lg" />
        <div className="h-4 w-72 max-w-full bg-zinc-800/60 rounded-md" />
      </div>
      <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/60 space-y-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-11 w-full bg-zinc-800/40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
