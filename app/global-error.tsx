"use client";

import React, { useEffect } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Layout Error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen flex items-center justify-center p-6 antialiased font-sans">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-2xl shadow-rose-950/50">
            <AlertOctagon className="w-10 h-10 text-rose-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-white">
              Critical System Error
            </h1>
            <p className="text-sm text-zinc-400">
              The root interface failed to render. Please reload to restore session state.
            </p>
          </div>

          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload Application</span>
          </button>
        </div>
      </body>
    </html>
  );
}
