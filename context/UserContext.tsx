"use client";

import React, { createContext, useContext, useState, useCallback, useTransition } from "react";
import { IUser } from "@/lib/db/models/User";
import { WeightUnit } from "@/lib/fitness/units";

interface UserContextType {
  user: IUser | null;
  weightUnit: WeightUnit;
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
  const [user, setUser] = useState<IUser | null>(initialUser);
  const [weightUnit, setLocalWeightUnit] = useState<WeightUnit>(
    (initialUser?.preferences?.weightUnit as WeightUnit) || "kg"
  );
  const [, startTransition] = useTransition();

  const setWeightUnit = useCallback(
    async (unit: WeightUnit) => {
      // Optimistic update
      setLocalWeightUnit(unit);
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          preferences: {
            ...prev.preferences,
            weightUnit: unit,
          },
        } as IUser;
      });

      // Persist to backend
      try {
        await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightUnit: unit }),
        });
      } catch (err) {
        console.error("Failed to save weight unit:", err);
      }
    },
    []
  );

  const toggleWeightUnit = useCallback(async () => {
    const nextUnit: WeightUnit = weightUnit === "kg" ? "lbs" : "kg";
    await setWeightUnit(nextUnit);
  }, [weightUnit, setWeightUnit]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          startTransition(() => {
            setUser(data.user);
            if (data.user.preferences?.weightUnit) {
              setLocalWeightUnit(data.user.preferences.weightUnit);
            }
          });
        }
      }
    } catch (err) {
      console.error("Failed to refresh user:", err);
    }
  }, []);

  const updateUserLocally = useCallback((updated: Partial<IUser>) => {
    setUser((prev) => (prev ? ({ ...prev, ...updated } as IUser) : null));
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        weightUnit,
        toggleWeightUnit,
        setWeightUnit,
        refreshUser,
        updateUserLocally,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    return {
      user: null,
      weightUnit: "kg" as WeightUnit,
      toggleWeightUnit: async () => {},
      setWeightUnit: async () => {},
      refreshUser: async () => {},
      updateUserLocally: () => {},
    };
  }
  return context;
}
