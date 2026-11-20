"use client";

import React, { useEffect } from "react";
import "./globals.css";

/**
 * Replaces the root layout when the layout itself fails, so it carries its
 * own <html> and <body> and loads the stylesheet itself.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] root layout error", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-app text-ink min-h-dvh antialiased">
        <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
          <div role="alert" className="w-full max-w-md space-y-3">
            <h1 className="text-2xl font-bold text-white">FitTracker could not start</h1>
            <p className="text-base text-zinc-300">
              Something went wrong on our side. Nothing you saved has been lost. Try again; if it keeps happening,
              check your connection.
            </p>
            {error?.digest && <p className="text-sm text-zinc-400">Reference: {error.digest}</p>}
          </div>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-6 text-base font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
