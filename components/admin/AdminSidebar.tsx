"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { Wordmark } from "@/components/shared/BrandMark";
import { ADMIN_NAV_ITEMS, HOME_PATH, isNavItemActive } from "@/constants/navigation";
import { logout } from "@/lib/client/logout";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  adminName: string;
  adminEmail: string;
}

/** The "Admin" tag next to the wordmark. */
export function AdminTag() {
  return <span className="rounded-chip border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2">Admin</span>;
}

/**
 * Admin navigation on desktop (768px+): the same 224px rail as the app, with
 * the admin sections, a way back to the app and the signed-in admin.
 */
export function AdminSidebar({ adminName, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <aside className="sticky top-0 hidden h-dvh w-(--rail-width) shrink-0 flex-col border-e border-line bg-canvas px-3 pt-4 pb-3 md:flex">
      <div className="mb-4 flex min-h-11 items-center gap-2 px-2.5">
        <Wordmark />
        <AdminTag />
      </div>

      <Link
        href={HOME_PATH}
        className="mb-3 flex min-h-10 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-elevated hover:text-ink"
      >
        <ArrowLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Back to the app
      </Link>

      <nav aria-label="Admin" className="flex flex-1 flex-col gap-0.5 overflow-y-auto border-t border-line pt-3">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
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
        })}
      </nav>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 ps-1">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-elevated text-xs font-semibold text-ink-2" aria-hidden="true">
          {adminName.charAt(0).toUpperCase() || "A"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{adminName}</span>
          <span className="block truncate text-xs text-ink-3">{adminEmail}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            if (isSigningOut) return;
            setIsSigningOut(true);
            void logout();
          }}
          aria-label="Sign out"
          title="Sign out"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-elevated hover:text-danger cursor-pointer"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
