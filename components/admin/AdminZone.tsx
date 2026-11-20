"use client";

import React, { createContext, useContext } from "react";

/** The signed-in admin's time zone, so dates render the same on the server and in the browser. */
const AdminZoneContext = createContext<string>("UTC");

export function AdminZoneProvider({ timeZone, children }: { timeZone: string; children: React.ReactNode }) {
  return <AdminZoneContext.Provider value={timeZone}>{children}</AdminZoneContext.Provider>;
}

export function useAdminZone(): string {
  return useContext(AdminZoneContext);
}

/** "Nov 19, 2026" in the given zone; "—" for missing or invalid values. */
export function formatAdminDate(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" }).format(date);
}

/** "Nov 19, 2026, 6:40 PM" in the given zone. */
export function formatAdminDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** 999,500 -> "1M", 12,345 -> "12.3K". */
export function formatCompact(value: number): string {
  return compact.format(value);
}
