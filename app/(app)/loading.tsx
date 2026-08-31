import React from "react";

export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard..."
      className="space-y-6 2xl:space-y-8 w-full max-w-[1800px] mx-auto pb-12 animate-pulse select-none"
    >
      {/* 1. Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/60">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-zinc-800 rounded-lg" />
          <div className="h-7 w-52 bg-zinc-800/80 rounded-xl" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-11 w-32 bg-zinc-800/80 rounded-2xl" />
          <div className="h-11 w-36 bg-zinc-800 rounded-2xl" />
        </div>
      </div>

      {/* 2. Quick Routine Banner Skeleton */}
      <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 bg-zinc-800/70 rounded-md" />
            <div className="h-5 w-64 bg-zinc-800/90 rounded-lg" />
          </div>
        </div>
        <div className="h-10 w-44 bg-zinc-800/80 rounded-2xl shrink-0" />
      </div>

      {/* 3. Primary 4-Metric Grid Skeleton */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800/60 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-zinc-800/70 rounded-md" />
              <div className="w-8 h-8 rounded-xl bg-zinc-800/80" />
            </div>
            <div className="space-y-2">
              <div className="h-8 w-28 bg-zinc-800/90 rounded-lg" />
              <div className="h-2 w-full bg-zinc-800/50 rounded-full" />
            </div>
            <div className="flex justify-between items-center pt-1">
              <div className="h-3 w-16 bg-zinc-800/60 rounded-md" />
              <div className="h-3 w-14 bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* 4. Middle 2-Column Split (Energy Flow + Weekly Split) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 2xl:gap-8">
        <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/60 h-80 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="h-5 w-44 bg-zinc-800/80 rounded-lg" />
            <div className="h-4 w-20 bg-zinc-800/60 rounded-md" />
          </div>
          <div className="h-48 w-full bg-zinc-800/30 rounded-2xl flex items-end justify-between p-4 gap-3">
            {[...Array(7)].map((_, j) => (
              <div
                key={j}
                className="w-full bg-zinc-800/60 rounded-t-lg"
                style={{ height: `${30 + ((j * 17) % 60)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-zinc-900/60 border border-zinc-800/60 h-80 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="h-5 w-48 bg-zinc-800/80 rounded-lg" />
            <div className="h-4 w-24 bg-zinc-800/60 rounded-md" />
          </div>
          <div className="grid grid-cols-7 gap-2 my-auto">
            {[...Array(7)].map((_, k) => (
              <div key={k} className="h-28 rounded-2xl bg-zinc-800/40 p-2 flex flex-col justify-between">
                <div className="h-3 w-6 bg-zinc-800/80 rounded" />
                <div className="w-6 h-6 rounded-full bg-zinc-800/60 mx-auto" />
                <div className="h-2 w-full bg-zinc-800/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
