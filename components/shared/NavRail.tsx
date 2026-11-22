"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { Wordmark } from "@/components/shared/BrandMark";
import { ProfileMenu } from "@/components/shared/ProfileMenu";
import { COACH_ITEM, HOME_PATH, RAIL_ITEMS, coachHref, isNavItemActive, type NavItem } from "@/constants/navigation";
import { cn } from "@/lib/utils";

function RailLink({ item, pathname, href }: { item: NavItem; pathname: string; href?: string }) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item);
  return (
    <Link
      href={href ?? item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors",
        active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-elevated hover:text-ink"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

/**
 * Desktop navigation (768px+): a 224px rail. Today, Train, Eat, Planner,
 * Habits, Body · Coach · Settings and the account pinned at the bottom.
 */
export function NavRail() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-(--rail-width) shrink-0 flex-col border-e border-line bg-canvas px-3 pt-4 pb-3 md:flex">
      <Link href={HOME_PATH} className="mb-5 flex min-h-11 items-center rounded-control px-2.5" aria-label="FitTracker, Today">
        <Wordmark />
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {RAIL_ITEMS.map((item) => (
          <RailLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="mx-3 my-2.5 h-px bg-line" role="presentation" />
        <RailLink item={COACH_ITEM} pathname={pathname} href={coachHref(pathname)} />
      </nav>

      <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
        <RailLink item={{ label: "Settings", href: "/settings", icon: Settings }} pathname={pathname} />
        <ProfileMenu variant="rail" omit={["/settings"]} />
      </div>
    </aside>
  );
}

export default NavRail;
