"use client";

import type { HabitDTO } from "@/lib/habits/dto";

/** Fetches JSON and throws an Error with a user-facing message unless `res.ok && success`. */
export async function requestJson<T extends object>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...(init.headers || {}) }
        : init?.headers,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new Error("You appear to be offline. Check your connection and try again.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  const payload = (data || {}) as { success?: boolean; error?: string };
  if (!res.ok || payload.success !== true) {
    if (res.status === 401) throw new Error("Your session has expired. Please sign in again.");
    throw new Error(payload.error || `Request failed (${res.status}). Please try again.`);
  }
  return data as T;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export interface HabitResponse {
  success: true;
  habit: HabitDTO;
}

export interface HabitLogsResponse {
  success: true;
  logs: Array<{ dateString: string; completedHabitIds: string[] }>;
}
