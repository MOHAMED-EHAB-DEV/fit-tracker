"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileMenu } from "@/components/shared/ProfileMenu";
import { HeaderSlotTarget } from "@/components/shared/HeaderSlot";
import { useUser } from "@/context/UserContext";
import { HOME_PATH, coachHref, hasOwnHeader, isFocusModePath, pageTitleFor } from "@/constants/navigation";
import { formatDateString, localDateString } from "@/lib/time";

/**
 * The shared page header: the screen's title (the tab label; Today shows the
 * date in the user's time zone), then Coach and the profile menu. On desktop
 * the rail carries Coach and the account, so only the title remains.
 */
export function AppHeader({ actions }: { actions?: React.ReactNode }) {
  const pathname = usePathname();
  const { timezone } = useUser();

  if (isFocusModePath(pathname) || hasOwnHeader(pathname)) return null;

  const isToday = pathname === HOME_PATH;
  const title = isToday ? formatDateString(localDateString(new Date(), timezone)) : (pageTitleFor(pathname) ?? "FitTracker");

  return (
    <PageHeader
      title={title}
      titleSuppressHydrationWarning={isToday}
      actions={
        <>
          <HeaderSlotTarget />
          {actions}
          <span className="flex items-center gap-1 md:hidden">
            <Link
              href={coachHref(pathname)}
              aria-label="Coach"
              title="Coach"
              className="relative grid h-10 w-10 place-items-center rounded-control text-ink-2 transition-colors hover:bg-elevated hover:text-ink before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
            >
              <MessageSquare className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <ProfileMenu />
          </span>
        </>
      }
    />
  );
}

export default AppHeader;
