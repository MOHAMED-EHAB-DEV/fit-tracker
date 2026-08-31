import React from "react";

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading admin dashboard..."
      className="space-y-6 w-full max-w-[1800px] mx-auto animate-pulse select-none"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-zinc-800 rounded-lg" />
          <div className="h-4 w-72 bg-zinc-800/60 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-zinc-800/80 rounded-xl" />
      </div>

      {/* KPI Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-24 bg-zinc-800/70 rounded" />
              <div className="w-7 h-7 rounded-lg bg-zinc-800/80" />
            </div>
            <div className="h-7 w-20 bg-zinc-800/90 rounded-md" />
            <div className="h-2.5 w-32 bg-zinc-800/50 rounded" />
          </div>
        ))}
      </div>

      {/* Table / Panel Skeleton */}
      <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/60 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-5 w-36 bg-zinc-800/80 rounded-md" />
          <div className="h-9 w-64 bg-zinc-800/60 rounded-xl" />
        </div>
        <div className="space-y-2 pt-2">
          {[...Array(5)].map((_, j) => (
            <div
              key={j}
              className="h-12 w-full bg-zinc-800/30 rounded-xl flex items-center justify-between px-4"
            >
              <div className="h-4 w-32 bg-zinc-800/60 rounded" />
              <div className="h-4 w-24 bg-zinc-800/50 rounded" />
              <div className="h-4 w-16 bg-zinc-800/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
