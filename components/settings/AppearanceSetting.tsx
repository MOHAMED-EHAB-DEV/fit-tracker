"use client";

import React from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useTheme } from "@/hooks/useTheme";
import { THEME_OPTIONS, type ThemePreference } from "@/lib/ui/theme";

/** System / Light / Dark. A device setting: it applies at once and is kept on this device. */
export function AppearanceSetting() {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl<ThemePreference>
      label="Appearance"
      value={preference}
      options={THEME_OPTIONS}
      onChange={setPreference}
      className="w-full sm:w-80"
    />
  );
}

export default AppearanceSetting;
