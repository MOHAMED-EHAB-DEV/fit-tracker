"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "light", label: "Light theme", Icon: Sun },
] as const;

/** Dark / light switch for the landing page header. Follows the system until used. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cn("inline-flex gap-0.5 rounded-chip border border-line bg-surface p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = resolved === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "relative grid h-[26px] w-7 place-items-center rounded-[4px] transition-colors cursor-pointer before:absolute before:-inset-2 before:content-['']",
              active ? "bg-elevated text-ink" : "text-ink-3 hover:text-ink"
            )}
          >
            <Icon className="h-[13px] w-[13px]" strokeWidth={1.75} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default ThemeSwitch;
