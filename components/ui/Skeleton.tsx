import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
  /** Number of stacked text lines (the last one shorter). */
  lines?: number;
}

/** Placeholder while content loads. Size it with classes (h-4 w-24, h-40 rounded-card). */
export function Skeleton({ className, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn("space-y-2", className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className={cn("skeleton h-3.5", index === lines - 1 ? "w-3/5" : "w-full")} />
        ))}
      </div>
    );
  }
  return <div className={cn("skeleton h-4", className)} aria-hidden="true" />;
}

/** A whole screen loading: header-sized bar and a few cards. */
export function ScreenSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 pt-2">
      <Skeleton className="h-10 w-full rounded-control" />
      {Array.from({ length: cards }, (_, index) => (
        <Skeleton key={index} className={cn("w-full rounded-card", index === 0 ? "h-44" : "h-28")} />
      ))}
    </div>
  );
}

export default Skeleton;
