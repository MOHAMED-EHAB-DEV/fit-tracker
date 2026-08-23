"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Menu, X, LogOut, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS } from "@/constants/navigation";

interface AdminMobileNavProps {
  adminName: string;
  adminEmail: string;
}

export function AdminMobileNav({ adminName, adminEmail }: AdminMobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <header className="md:hidden sticky top-0 z-40 bg-zinc-950/95 border-b border-violet-900/30 backdrop-blur-md px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-violet-600 to-purple-500 p-0.5 shadow-md shadow-violet-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-zinc-950 rounded-[6px] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-violet-400" aria-hidden="true" />
            </div>
          </div>
          <span className="font-extrabold text-sm text-white">
            Fit<span className="text-violet-400">Admin</span>
          </span>
        </div>

        {/* Menu toggle button */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Back to app"
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 bg-zinc-900/80 border border-zinc-800 text-xs flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>App</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? "Close admin menu" : "Open admin menu"}
            aria-expanded={isOpen}
            className="p-2 min-h-[40px] min-w-[40px] rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Dropdown Drawer */}
      {isOpen && (
        <div className="pt-4 pb-2 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <nav aria-label="Admin mobile navigation" className="space-y-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-colors",
                    isActive
                      ? "bg-violet-500/15 text-violet-300 font-semibold border border-violet-500/30"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-violet-400" : "text-zinc-400")} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-violet-900/30 flex items-center justify-between px-2">
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-200 truncate">{adminName}</p>
              <p className="text-[10px] text-violet-400/70 truncate">{adminEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default AdminMobileNav;
