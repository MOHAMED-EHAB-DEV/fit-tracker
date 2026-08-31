import React from "react";

export default function AuthLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading authentication..."
      className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950 select-none animate-pulse"
    >
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-6 shadow-2xl">
        {/* Brand Icon Placeholder */}
        <div className="w-12 h-12 rounded-2xl bg-zinc-800 mx-auto" />

        {/* Title & Subtitle */}
        <div className="space-y-2 text-center">
          <div className="h-6 w-40 bg-zinc-800 rounded-lg mx-auto" />
          <div className="h-3.5 w-56 bg-zinc-800/60 rounded-md mx-auto" />
        </div>

        {/* Inputs */}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="h-3 w-16 bg-zinc-800/80 rounded" />
            <div className="h-11 w-full bg-zinc-800/50 rounded-xl" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-zinc-800/80 rounded" />
            <div className="h-11 w-full bg-zinc-800/50 rounded-xl" />
          </div>
        </div>

        {/* Submit Button */}
        <div className="h-12 w-full bg-zinc-800 rounded-2xl mt-4" />

        {/* Footer Link */}
        <div className="h-3.5 w-48 bg-zinc-800/40 rounded mx-auto pt-2" />
      </div>
    </div>
  );
}
