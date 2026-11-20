"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Camera, Dumbbell, Sparkles, Zap } from "lucide-react";

const QuickLogModal = dynamic(
  () => import("@/components/dashboard/QuickLogModal").then((mod) => mod.QuickLogModal),
  { ssr: false }
);

export interface DashboardClientHeaderProps {
  /** The user's first name; null/empty shows a neutral greeting. */
  userName: string | null;
  /** Today's water (ml), passed to the Quick Log modal. */
  waterMl: number;
  /** Today in the user's time zone, already formatted ("Thursday, November 19"). */
  dateLabel?: string;
}

/** First word of a display name, or null. */
export function firstName(name: string | null | undefined): string | null {
  const first = (name || "").trim().split(/\s+/)[0];
  return first ? first : null;
}

const SECONDARY_LINK =
  "hidden md:inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-zinc-200 hover:bg-surface-2";

/**
 * Greeting and quick logging. On phones only "Quick log" is shown: starting a
 * workout, meals and the coach live in the bottom bar and its + button.
 */
export function DashboardClientHeader({ userName, waterMl, dateLabel }: DashboardClientHeaderProps) {
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const name = firstName(userName);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-white">{name ? `Hello, ${name}` : "Hello"}</h1>
          <p className="text-sm text-zinc-400">{dateLabel || "Your day at a glance"}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/workouts" className={SECONDARY_LINK}>
            <Dumbbell className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Train
          </Link>
          <Link href="/nutrition/analyze?from=dashboard" className={SECONDARY_LINK}>
            <Camera className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Photo meal
          </Link>
          <Link href="/coach" className={SECONDARY_LINK}>
            <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            Coach
          </Link>
          <button
            type="button"
            onClick={() => setIsQuickLogOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Quick log
          </button>
        </div>
      </div>

      <QuickLogModal isOpen={isQuickLogOpen} onClose={() => setIsQuickLogOpen(false)} initialWaterMl={waterMl} />
    </>
  );
}

export default DashboardClientHeader;
