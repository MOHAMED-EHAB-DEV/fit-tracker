"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAB_ITEMS, isFocusModePath, isNavItemActive } from "@/constants/navigation";
import { cn } from "@/lib/utils";

/**
 * Phone navigation (below 768px): Today · Train · Eat · Plan · Body on a glass
 * bar. Hidden during the live workout (focus mode), where the session dock
 * takes the bottom edge.
 */
export function TabBar() {
  const pathname = usePathname();

  if (isFocusModePath(pathname)) {
    // Marker read by app/globals.css (html:has([data-focus-mode])): the page
    // reserves no room for the bar while it is hidden.
    return <span data-focus-mode="" hidden />;
  }

  return (
    <nav aria-label="Main" className="glass-chrome fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto grid h-(--nav-height) max-w-lg grid-cols-5 px-2">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-accent" : "text-ink-3 hover:text-ink-2"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default TabBar;
