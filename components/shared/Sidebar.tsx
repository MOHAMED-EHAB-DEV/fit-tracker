"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { logout } from "@/lib/client/logout";
import {
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  isNavItemActive,
  type NavItem,
} from "@/constants/navigation";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-medium transition-colors",
        active ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-300 hover:text-white hover:bg-white/5"
      )}
    >
      <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

/** Desktop navigation. Phones use the bottom tab bar instead. */
export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const isNative = useIsNativeApp();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const secondary = SECONDARY_NAV_ITEMS.filter((item) => !item.nativeOnly || isNative);

  return (
    <aside className="hidden md:flex sticky top-0 h-dvh w-60 shrink-0 flex-col border-e border-line bg-app px-3 py-4">
      <Link href="/" className="flex items-center gap-2.5 px-3 min-h-11 mb-4 rounded-xl">
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-emerald-500 text-zinc-950">
          <Dumbbell className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="text-base font-bold text-white">FitTracker</span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto space-y-1">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="my-3 border-t border-line" role="presentation" />
        {secondary.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        {user?.role === "admin" && (
          <>
            <div className="my-3 border-t border-line" role="presentation" />
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>Admin</span>
            </Link>
          </>
        )}
      </nav>

      <div className="mt-3 pt-3 border-t border-line">
        <div className="px-3 pb-2 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{user?.name || "Account"}</p>
          <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          disabled={isLoggingOut}
          onClick={() => {
            setIsLoggingOut(true);
            void logout();
          }}
          className="flex w-full items-center gap-3 px-3 min-h-11 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-60"
        >
          <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
