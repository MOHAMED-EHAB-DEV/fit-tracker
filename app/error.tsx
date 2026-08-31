"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home, LifeBuoy } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception safely
    console.error("Root Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 relative select-none">
      {/* Ambient Red/Rose Warning Glow */}
      <div className="absolute w-96 h-96 rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md mx-auto text-center space-y-6 z-10">
        {/* Warning Icon Badge */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-2xl shadow-rose-950/40 backdrop-blur-xl">
            <AlertTriangle className="w-10 h-10 text-rose-400 animate-pulse" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold uppercase tracking-wider mb-1">
            Application Error
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Something Went Wrong
          </h1>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto leading-relaxed">
            An unexpected error occurred while loading this view. Your logged data remains secure.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded-lg inline-block border border-zinc-800">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold border border-zinc-800 transition active:scale-[0.98]"
          >
            <Home className="w-4 h-4 text-emerald-400" />
            <span>Return Home</span>
          </Link>
        </div>

        {/* Help / Guidance */}
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-start space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <LifeBuoy className="w-4 h-4 text-teal-400" />
            <span>Troubleshooting tip</span>
          </div>
          <p className="text-xs text-zinc-400 leading-normal">
            If this issue persists in the mobile app, try reconnecting your network or checking for application updates in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
