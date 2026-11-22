"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Popover";
import { useUser } from "@/context/UserContext";
import { useIsNativeApp } from "@/hooks/useIsNativeApp";
import { logout } from "@/lib/client/logout";
import { PROFILE_MENU_ITEMS, visibleNavItems } from "@/constants/navigation";
import { cn } from "@/lib/utils";

/** Up to two initials from a display name ("Alex Morgan" -> "AM"). */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-line-strong bg-elevated text-xs font-semibold text-ink",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

export interface ProfileMenuProps {
  /** "header": the avatar button. "rail": avatar, name and email across the rail. */
  variant?: "header" | "rail";
  /** Leave items out (the rail shows Settings as its own row). */
  omit?: readonly string[];
}

/** Settings, Admin (admins), Widgets (Android app) and Sign out. */
export function ProfileMenu({ variant = "header", omit = [] }: ProfileMenuProps) {
  const { user } = useUser();
  const isNative = useIsNativeApp();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const items = visibleNavItems(PROFILE_MENU_ITEMS, { isAdmin: user?.role === "admin", isNative }).filter(
    (item) => !omit.includes(item.href)
  );
  const name = user?.name || "Account";

  return (
    <Popover
      role="menu"
      label="Account"
      align={variant === "header" ? "end" : "start"}
      side={variant === "header" ? "bottom" : "top"}
      className="w-64"
      triggerLabel={variant === "header" ? `Account: ${name}` : undefined}
      triggerClassName={
        variant === "header"
          ? "relative grid h-11 w-11 place-items-center rounded-full"
          : "flex min-h-12 w-full items-center gap-2.5 rounded-control px-2 text-start transition-colors hover:bg-elevated"
      }
      trigger={
        variant === "header" ? (
          <Avatar name={user?.name} />
        ) : (
          <>
            <Avatar name={user?.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{name}</span>
              {user?.email && <span className="block truncate text-xs text-ink-3">{user.email}</span>}
            </span>
          </>
        )
      }
    >
      {({ close }) => (
        <>
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            {user?.email && <p className="truncate text-xs text-ink-3">{user.email}</p>}
          </div>
          {items.length > 0 && (
            <>
              <MenuSeparator />
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <MenuItem key={item.href} href={item.href} icon={<Icon className="h-[18px] w-[18px]" />} onSelect={close}>
                    {item.label}
                  </MenuItem>
                );
              })}
            </>
          )}
          <MenuSeparator />
          <MenuItem
            icon={<LogOut className="h-[18px] w-[18px]" />}
            disabled={isSigningOut}
            onSelect={() => {
              setIsSigningOut(true);
              void logout();
            }}
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

export default ProfileMenu;
