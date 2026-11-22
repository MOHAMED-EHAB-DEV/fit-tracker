"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { Wordmark } from "@/components/shared/BrandMark";
import { AdminTag } from "@/components/admin/AdminSidebar";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedNav } from "@/components/ui/SegmentedControl";
import { ADMIN_NAV_ITEMS, HOME_PATH, isNavItemActive } from "@/constants/navigation";
import { logout } from "@/lib/client/logout";

interface AdminMobileNavProps {
  adminName: string;
  adminEmail: string;
}

/**
 * Admin navigation on phones: a glass top bar (back to the app · wordmark ·
 * sign out) with the four admin sections as a segmented row under it.
 */
export function AdminMobileNav({ adminName, adminEmail }: AdminMobileNavProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <header className="glass-chrome-top sticky top-0 z-40 border-b border-line px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 md:hidden">
      <div className="flex min-h-11 items-center gap-2">
        <Link
          href={HOME_PATH}
          aria-label="Back to the app"
          className="-ms-2 grid h-11 w-11 shrink-0 place-items-center rounded-control text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Wordmark size={24} />
          <AdminTag />
        </span>
        <IconButton
          label={`Sign out ${adminName}${adminEmail ? ` (${adminEmail})` : ""}`}
          icon={<LogOut className="h-[18px] w-[18px]" />}
          disabled={isSigningOut}
          onClick={() => {
            setIsSigningOut(true);
            void logout();
          }}
          className="-me-2"
        />
      </div>
      <SegmentedNav
        label="Admin sections"
        className="mt-2 w-full grid-cols-4"
        items={ADMIN_NAV_ITEMS.map((item) => ({ href: item.href, label: item.label, active: isNavItemActive(pathname, item) }))}
      />
    </header>
  );
}

export default AdminMobileNav;
