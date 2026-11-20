"use client";

import { useUser } from "@/hooks/useUser";
import { localDateString, resolveTimeZone } from "@/lib/time";

/** The signed-in user's IANA zone (same value on the server render and the device). */
export function useUserTimeZone(): string {
  const { user } = useUser();
  return resolveTimeZone(user?.preferences?.timezone);
}

/** The user's calendar date right now; call it at the moment of an action, not once at render. */
export function todayInZone(tz: string): string {
  return localDateString(new Date(), tz);
}
