"use client";

import React, { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button-styles";
import { THEME_INIT_SCRIPT } from "@/lib/ui/theme";
import "./globals.css";

/**
 * Replaces the root layout when the layout itself fails, so it carries its
 * own <html> and <body>, loads the stylesheet itself and applies the saved
 * theme with the same early script.
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
          <div role="alert" className="w-full max-w-md space-y-3">
            <h1 className="text-title text-ink">FitTracker could not start</h1>
            <p className="text-sm leading-6 text-ink-2">
              Something went wrong on our side. Nothing you saved has been lost. Try again; if it keeps happening,
              check your connection.
            </p>
            {error?.digest && (
              <p className="text-[13px] text-ink-3">
                Reference: <span className="font-mono">{error.digest}</span>
              </p>
            )}
          </div>
          <button type="button" onClick={() => retry()} className={buttonClasses({ variant: "primary", size: "lg", className: "mt-6 px-6" })}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
