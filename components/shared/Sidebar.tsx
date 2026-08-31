"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dumbbell, LogOut } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { MAIN_NAV_ITEMS as NAV_ITEMS } from "@/constants/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

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
    <aside className="hidden md:flex flex-col w-64 h-screen bg-zinc-950 border-r border-zinc-800/80 p-5 sticky top-0 shrink-0 select-none">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 px-2 py-3 mb-6 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
        <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center">
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
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold shadow-sm border border-emerald-500/20"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform group-hover:scale-110",
                  isActive ? "text-emerald-400" : "text-zinc-400 group-hover:text-zinc-200"
                )}
                aria-hidden="true"
              />
              <span>{item.label}</span>
              {isActive && (
                <div className="w-1.5 h-5 bg-emerald-400 rounded-full absolute right-2" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="pt-4 border-t border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-200 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            aria-label="Log Out"
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
