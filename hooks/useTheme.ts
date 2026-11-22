"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  readThemePreference,
  resolveTheme,
  storeThemePreference,
  systemPrefersDark,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/ui/theme";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  query.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    query.removeEventListener("change", onChange);
  };
}

/** "preference|resolved", so one snapshot string covers both values. */
function snapshot(): string {
  const preference = readThemePreference();
  return `${preference}|${resolveTheme(preference, systemPrefersDark())}`;
}

export interface UseThemeResult {
  /** What the user chose on this device. */
  preference: ThemePreference;
  /** The theme on screen now. "light" during server rendering. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

/**
 * The theme choice (System / Light / Dark). The page is already painted in
 * the right theme by the script in app/layout.tsx; this hook reads and
 * changes that choice.
 */
export function useTheme(): UseThemeResult {
  const value = useSyncExternalStore(subscribe, snapshot, () => "system|light");
  const [preference, resolved] = value.split("|") as [ThemePreference, ResolvedTheme];
  const setPreference = useCallback((next: ThemePreference) => storeThemePreference(next), []);
  return { preference, resolved, setPreference };
}

export default useTheme;
