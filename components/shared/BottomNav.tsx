"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/Drawer";
import { QuickActionsSheet } from "@/components/shared/QuickActionsSheet";
import { useUser } from "@/context/UserContext";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { logout } from "@/lib/client/logout";
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, isNavItemActive } from "@/constants/navigation";

const TAB_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-0.5 min-h-14 text-xs font-medium transition-colors cursor-pointer";

/**
 * Phone navigation: Today · Train · (+) · Eat · More.
 * The centre button opens the quick actions; "More" opens the other sections.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const isNative = useIsNativeApp();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const secondary = SECONDARY_NAV_ITEMS.filter((item) => !item.nativeOnly || isNative);
  const moreActive = secondary.some((item) => isNavItemActive(pathname, item.href));
  const [today, train, eat] = PRIMARY_NAV_ITEMS;

  const tab = (item: (typeof PRIMARY_NAV_ITEMS)[number]) => {
    const Icon = item.icon;
    const active = isNavItemActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(TAB_CLASS, active ? "text-emerald-400" : "text-zinc-400")}
      >
        <Icon className="w-6 h-6" aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-app/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-stretch h-(--nav-height) px-1">
          {tab(today)}
          {tab(train)}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setIsQuickOpen(true)}
              aria-label="Quick add"
              aria-haspopup="dialog"
              className="grid place-items-center w-12 h-12 rounded-full bg-emerald-500 text-zinc-950 active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
          {tab(eat)}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(TAB_CLASS, moreActive ? "text-emerald-400" : "text-zinc-400")}
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <QuickActionsSheet isOpen={isQuickOpen} onClose={() => setIsQuickOpen(false)} />

      <Drawer isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} title="More" position="bottom">
        <ul className="space-y-1">
          {secondary.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 min-h-12 rounded-xl text-base font-medium",
                    active ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-200 active:bg-white/5"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          {user?.role === "admin" && (
            <li>
              <Link
                href="/admin/dashboard"
                onClick={() => setIsMoreOpen(false)}
                className="flex items-center gap-3 px-3 min-h-12 rounded-xl text-base font-medium text-zinc-200 active:bg-white/5"
              >
                <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Admin</span>
              </Link>
            </li>
          )}
        </ul>

        <div className="mt-4 pt-4 border-t border-line">
          <p className="px-3 text-sm font-semibold text-white truncate">{user?.name}</p>
          <p className="px-3 text-sm text-zinc-400 truncate">{user?.email}</p>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => {
              setIsLoggingOut(true);
              void logout();
            }}
            className="mt-2 flex w-full items-center gap-3 px-3 min-h-12 rounded-xl text-base font-medium text-zinc-200 active:bg-white/5 cursor-pointer disabled:opacity-60"
          >
            <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </Drawer>
    </>
  );
}

export default BottomNav;
