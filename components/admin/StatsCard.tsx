import React from "react";
import type { LucideIcon } from "lucide-react";
import { Stat } from "@/components/ui/Stat";
import { Surface } from "@/components/ui/Surface";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: number | string;
  /** A short line under the number ("this week", "42%"). */
  delta?: string | null;
  /** false shows the line in the danger colour. */
  deltaPositive?: boolean;
  icon: LucideIcon;
  /** Shows the number in the danger colour when it is above zero (e.g. banned accounts). */
  alertWhenPositive?: boolean;
  className?: string;
}

/** One admin figure: label and icon, a mono number, an optional caption. */
export function StatsCard({ label, value, delta, deltaPositive = true, icon: Icon, alertWhenPositive = false, className }: StatsCardProps) {
  const alert = alertWhenPositive && typeof value === "number" && value > 0;
  return (
    <Surface className={cn("relative p-4", className)}>
      <Icon className="absolute end-4 top-4 h-4 w-4 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
      <Stat
        label={<span className="block pe-6 text-[13px] text-ink-2">{label}</span>}
        value={typeof value === "number" ? value.toLocaleString("en-US") : value}
        size="display"
        tone={alert ? "danger" : "ink"}
        caption={delta != null ? <span className={deltaPositive ? "text-ink-3" : "text-danger"}>{delta}</span> : undefined}
      />
    </Surface>
  );
}

export default StatsCard;
