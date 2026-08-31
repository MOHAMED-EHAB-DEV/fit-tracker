"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS } from "@/constants/navigation";

interface AdminSidebarProps {
  adminName: string;
  adminEmail: string;
}

export function AdminSidebar({ adminName, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-zinc-950 border-r border-violet-900/30 p-5 sticky top-0 shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-violet-600 to-purple-500 p-0.5 shadow-lg shadow-violet-500/25 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-violet-400" aria-hidden="true" />
          </div>
        </div>
        <div>
          <span className="font-extrabold text-lg tracking-tight text-white block">
            Fit<span className="text-violet-400">Admin</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500/80 block">
            Control Panel
          </span>
        </div>
      </div>

      {/* Back to App */}
      <Link
        href="/"
        aria-label="Back to FitTracker App"
        className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl text-xs text-zinc-500 hover:text-violet-400 hover:bg-violet-500/5 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <ChevronRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
        <span>Back to App</span>
      </Link>

      {/* Navigation Links */}
      <nav aria-label="Admin desktop navigation" className="flex-1 space-y-1.5">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                isActive
                  ? "bg-violet-500/10 text-violet-400 font-semibold shadow-sm border border-violet-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110",
                  isActive ? "text-violet-400" : "text-zinc-400 group-hover:text-zinc-200"
                )}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-5 bg-violet-400 rounded-full absolute right-2" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin Info & Logout */}
      <div className="pt-4 border-t border-violet-900/30 space-y-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-violet-950/40 border border-violet-800/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-400 flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
              {adminName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-200 truncate">{adminName}</p>
              <p className="text-[10px] text-violet-400/70 truncate">{adminEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            aria-label="Log Out"
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-1">
          <ShieldCheck className="w-3 h-3 text-violet-500" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500">Admin</span>
        </div>
      </div>
    </aside>
  );
}

export default AdminSidebar;
