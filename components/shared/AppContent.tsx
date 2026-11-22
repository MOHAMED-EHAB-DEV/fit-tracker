"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { hasOwnHeader, isFocusModePath } from "@/constants/navigation";
import { cn } from "@/lib/utils";

/**
 * The content column: 1120px wide (two columns from 1024px inside the
 * screens), 680px for the live workout. Screens without the shared header
 * keep the status-bar inset themselves.
 */
export function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focus = isFocusModePath(pathname);
  const ownHeader = hasOwnHeader(pathname);
  // The live workout and the routine editor have sticky top bars that carry the status-bar inset.
  const ownTopBar = focus || pathname.startsWith("/workouts/routines/");

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        focus ? "max-w-[680px]" : "max-w-[1120px]",
        ownTopBar ? "pt-0" : ownHeader ? "pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6" : "pt-1 md:pt-2"
      )}
    >
      {children}
    </div>
  );
}

export default AppContent;
