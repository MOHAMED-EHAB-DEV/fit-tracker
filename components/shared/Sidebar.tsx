"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dumbbell, LogOut, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS as NAV_ITEMS } from "@/constants/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle escape key and body scroll lock for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
      }
    };
    if (isMobileOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    <>
      {/* Mobile Floating Reveal Button (Hidden on Desktop) */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open navigation menu"
        className="md:hidden fixed bottom-5 inset-s-5 z-40 px-3.5 py-2.5 rounded-2xl bg-zinc-900/90 border border-white/10 text-emerald-400 shadow-2xl backdrop-blur-xl hover:bg-zinc-800 transition active:scale-95 cursor-pointer flex items-center gap-2"
      >
        <Menu className="w-5 h-5 text-emerald-400" />
        <span className="text-xs font-bold text-white">Menu</span>
      </button>

      {/* Mobile Drawer Overlay & Slide-Over Panel (Hidden on Desktop) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="fixed inset-y-0 inset-s-0 w-72 max-w-[85vw] h-full bg-zinc-950 border-e border-zinc-800/80 p-5 flex flex-col shadow-2xl z-50 animate-in slide-in-from-start duration-200 select-none overflow-y-auto">
            {/* Header with Brand & Close Button */}
            <div className="flex items-center justify-between mb-6">
              <Link
                href="/"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-3 px-2 py-1.5 rounded-2xl"
              >
                <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0">
                  <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <span className="font-extrabold text-lg tracking-tight text-white block">
                    Fit<span className="text-emerald-400">Tracker</span>
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80 block">
                    AI Companion
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Navigation Links */}
            <nav aria-label="Mobile main navigation" className="flex-1 space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 group relative",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 font-semibold shadow-xs border border-emerald-500/20"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-transform group-hover:scale-110 shrink-0",
                        isActive ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200"
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                    {isActive && (
                      <div className="w-1.5 h-5 bg-emerald-400 rounded-full absolute inset-e-2" aria-hidden="true" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile User Info & Logout */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-2 mt-auto">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0"
                    aria-hidden="true"
                    title={user?.name || "User"}
                  >
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-zinc-200 truncate">{user?.name || "User"}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log Out"
                  aria-label="Log Out"
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sticky Collapsible Sidebar (Maintained Original Design) */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen bg-zinc-950 border-e border-zinc-800/80 sticky top-0 shrink-0 select-none transition-all duration-300",
          isCollapsed ? "w-20 p-3" : "w-64 p-5"
        )}
      >
        {/* Brand & Collapse Toggle */}
        <div className={cn("flex items-center mb-6", isCollapsed ? "justify-center" : "justify-between")}>
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 rounded-2xl focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50",
              !isCollapsed && "px-2 py-1.5"
            )}
            title="FitTracker"
          >
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-emerald-400" aria-hidden="true" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <span className="font-extrabold text-lg tracking-tight text-white block">
                  Fit<span className="text-emerald-400">Tracker</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80 block">
                  AI Companion
                </span>
              </div>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div className="flex justify-center mb-4">
            <button
              onClick={toggleCollapsed}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav aria-label="Main navigation" className="flex-1 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-xl font-medium text-sm transition-all duration-200 group relative focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                  isCollapsed
                    ? "justify-center p-3"
                    : "gap-3.5 px-3.5 py-3",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 font-semibold shadow-xs border border-emerald-500/20"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform group-hover:scale-110 shrink-0",
                    isActive ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200"
                  )}
                  aria-hidden="true"
                />
                {!isCollapsed && <span>{item.label}</span>}
                {isActive && (
                  <div
                    className={cn(
                      "w-1.5 h-5 bg-emerald-400 rounded-full absolute inset-e-2",
                      isCollapsed && "inset-e-1"
                    )}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-2">
          <div
            className={cn(
              "flex items-center rounded-xl bg-zinc-900/60 border border-zinc-800/60",
              isCollapsed ? "flex-col p-2 gap-2" : "justify-between px-3 py-2"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3 overflow-hidden",
                isCollapsed && "justify-center"
              )}
            >
              <div
                className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0"
                aria-hidden="true"
                title={user?.name || "User"}
              >
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              {!isCollapsed && (
                <div className="truncate">
                  <p className="text-xs font-semibold text-zinc-200 truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              title="Log Out"
              aria-label="Log Out"
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500/50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
