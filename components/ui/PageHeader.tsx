"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useScrolled } from "@/hooks/useScrolled";

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Before the title (a back or close button). */
  leading?: React.ReactNode;
  /** Right-hand controls (streak chip, Coach, profile). */
  actions?: React.ReactNode;
  /** Stays at the top while the page scrolls; turns to glass once content passes under it. */
  sticky?: boolean;
  /** Suppresses the server/client difference warning for clock-based titles ("Sat, Nov 21"). */
  titleSuppressHydrationWarning?: boolean;
  /** Classes for the full-width bar. */
  className?: string;
  /** Classes for the inner row (width and padding); defaults to the app's content column. */
  innerClassName?: string;
}

/**
 * The top bar of a screen: title (the tab label) and its actions. 52px tall
 * plus the status-bar inset; matte while the page is at the top, glass once
 * content scrolls under it.
 */
export function PageHeader({
  title,
  leading,
  actions,
  sticky = true,
  titleSuppressHydrationWarning = false,
  className,
  innerClassName,
}: PageHeaderProps) {
  const scrolled = useScrolled(sticky);

  return (
    <header
      className={cn(
        "z-30 border-b border-transparent pt-[env(safe-area-inset-top)] transition-[background-color,border-color,box-shadow] duration-200",
        sticky && "sticky top-0",
        scrolled && "glass-chrome-top",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-(--header-height) w-full max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6",
          innerClassName
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          {leading}
          <h1
            className="truncate text-title font-semibold text-ink"
            suppressHydrationWarning={titleSuppressHydrationWarning}
          >
            {title}
          </h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;
