import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: number | string;
  delta?: string | null;
  deltaPositive?: boolean;
  icon: LucideIcon;
  iconColor?: string;
  bgColor?: string;
  className?: string;
}

export function StatsCard({
  label,
  value,
  delta,
  deltaPositive = true,
  icon: Icon,
  iconColor = "text-violet-400",
  bgColor = "bg-violet-500/10",
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        "bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 flex flex-col gap-3 hover:border-violet-800/40 transition-colors group",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", bgColor)}>
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>
      </div>

      <div>
        <p className="text-3xl font-extrabold text-white tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {delta != null && (
          <p
            className={cn(
              "text-xs font-medium mt-1",
              deltaPositive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {deltaPositive ? "+" : ""}{delta}
          </p>
        )}
      </div>
    </div>
  );
}

export default StatsCard;
