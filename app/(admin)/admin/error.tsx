"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RotateCcw, LayoutDashboard } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Panel Error:", error);
  }, [error]);

  return (
    <div className="w-full max-w-xl mx-auto py-12 px-4 select-none">
      <div className="p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl space-y-6 text-center backdrop-blur-xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-white">
            Admin Console Exception
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            An error occurred while evaluating administrative data feeds or user catalogs.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-zinc-400 bg-zinc-950/80 px-2 py-1 rounded-lg inline-block border border-zinc-800 mt-2">
              Trace: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Panel Query</span>
          </button>
          <Link
            href="/admin"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Admin Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
