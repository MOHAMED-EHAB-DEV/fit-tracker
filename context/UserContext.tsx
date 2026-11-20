"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { IUser } from "@/lib/db/models/User";
import { normalizeWeightUnit, type WeightUnit } from "@/lib/fitness/units";
import { normalizeWeekStart, resolveTimeZone, type WeekdayKey } from "@/lib/time";
import { api } from "@/lib/client/api";

/**
 * The signed-in user as the browser sees them. It never contains secrets:
 * the personal AI key is reduced to `preferences.hasCustomGeminiKey`.
 */
export type ClientUser = IUser & {
  preferences: IUser["preferences"] & { hasCustomGeminiKey?: boolean };
};

interface UserContextType {
  user: ClientUser | null;
  /** How the user wants weights shown. Stored values are always kilograms. */
  weightUnit: WeightUnit;
  /** The user's IANA time zone; every "today" in the app is computed in it. */
  timezone: string;
  weekStartDay: WeekdayKey;
  toggleWeightUnit: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserLocally: (updated: Partial<IUser>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: IUser | null;
}) {
  const [user, setUser] = useState<ClientUser | null>(initialUser as ClientUser | null);

  const weightUnit = normalizeWeightUnit(user?.preferences?.weightUnit);
  const timezone = resolveTimeZone(user?.preferences?.timezone);
  const weekStartDay = normalizeWeekStart(user?.preferences?.weekStartDay);

  const applyUnit = useCallback((unit: WeightUnit) => {
    setUser((previous) =>
      previous ? ({ ...previous, preferences: { ...previous.preferences, weightUnit: unit } } as ClientUser) : previous
    );
  }, []);

  const setWeightUnit = useCallback(
    async (unit: WeightUnit) => {
      const before = weightUnit;
      applyUnit(unit);
      try {
        await api("/api/user/preferences", { method: "PATCH", body: { weightUnit: unit } });
      } catch (err) {
        // Not saved: show the old unit again rather than pretending.
        applyUnit(before);
        throw err;
      }
    },
    [applyUnit, weightUnit]
  );

  const toggleWeightUnit = useCallback(async () => {
    await setWeightUnit(weightUnit === "kg" ? "lbs" : "kg");
  }, [weightUnit, setWeightUnit]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api<{ user?: ClientUser }>("/api/auth/me");
      if (data.user) setUser(data.user);
    } catch {
      // Keep the copy we have; the next navigation re-reads it on the server.
    }
  }, []);

  const updateUserLocally = useCallback((updated: Partial<IUser>) => {
    setUser((previous) => (previous ? ({ ...previous, ...updated } as ClientUser) : previous));
  }, []);

  const value = useMemo<UserContextType>(
    () => ({
      user,
      weightUnit,
      timezone,
      weekStartDay,
      toggleWeightUnit,
      setWeightUnit,
      refreshUser,
      updateUserLocally,
    }),
    [user, weightUnit, timezone, weekStartDay, toggleWeightUnit, setWeightUnit, refreshUser, updateUserLocally]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

const FALLBACK: UserContextType = {
  user: null,
  weightUnit: "kg",
  timezone: resolveTimeZone(null),
  weekStartDay: normalizeWeekStart(null),
  toggleWeightUnit: async () => undefined,
  setWeightUnit: async () => undefined,
  refreshUser: async () => undefined,
  updateUserLocally: () => undefined,
};

export function useUser(): UserContextType {
  return useContext(UserContext) ?? FALLBACK;
}
