"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RotateCcw, LayoutDashboard } from "lucide-react";

export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Admin panel error:", error);
  }, [error]);

  return (
    <div className="w-full max-w-xl mx-auto py-12 px-4">
      <div role="alert" className="p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-white">This admin page could not load</h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
            The data could not be read, usually because of a temporary database or network problem. Try again; if it
            keeps failing, check the server logs.
          </p>
          {error?.digest && (
            <p className="text-xs font-mono text-zinc-400 bg-zinc-950/80 px-2 py-1 rounded-lg inline-block border border-zinc-800 mt-2">
              Error reference: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => retry()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 min-h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Try again</span>
          </button>
          <Link
            href="/admin/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 min-h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold border border-zinc-700 transition"
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>Admin dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
