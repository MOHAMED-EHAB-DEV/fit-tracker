"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RotateCcw, ArrowLeft } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Authentication View Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-zinc-950 select-none">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl space-y-6 text-center backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-white">
            Authentication Service Unavailable
          </h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            We were unable to initialize the secure sign-in channel. Please try again.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
