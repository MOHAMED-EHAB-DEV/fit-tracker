import React from "react";
import { AlertCircle, CheckCircle2, Droplet, Flame, Leaf, Target, Wheat } from "lucide-react";
import { formatAmount, macroGoalStatus, type MacroGoalKind } from "@/lib/nutrition/totals";

export interface MacroStatsData {
  calories: { consumed: number; target: number };
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
  fiber: { consumed: number; target: number };
}

interface MacroCardConfig {
  key: keyof MacroStatsData;
  name: string;
  unit: string;
  kind: MacroGoalKind;
  kcalPerUnit?: number;
  icon: React.ReactNode;
  accent: string;
  bar: string;
  badge: string;
}

const CARDS: MacroCardConfig[] = [
  { key: "calories", name: "Calories", unit: "kcal", kind: "limit", icon: <Flame className="w-4 h-4" />, accent: "text-orange-300", bar: "from-orange-500 to-amber-400", badge: "bg-orange-500/10" },
  { key: "protein", name: "Protein", unit: "g", kind: "minimum", kcalPerUnit: 4, icon: <Target className="w-4 h-4" />, accent: "text-emerald-300", bar: "from-emerald-500 to-teal-400", badge: "bg-emerald-500/10" },
  { key: "carbs", name: "Carbs", unit: "g", kind: "limit", kcalPerUnit: 4, icon: <Wheat className="w-4 h-4" />, accent: "text-amber-300", bar: "from-amber-500 to-yellow-400", badge: "bg-amber-500/10" },
  { key: "fat", name: "Fat", unit: "g", kind: "limit", kcalPerUnit: 9, icon: <Droplet className="w-4 h-4" />, accent: "text-rose-300", bar: "from-rose-500 to-orange-400", badge: "bg-rose-500/10" },
  { key: "fiber", name: "Fiber", unit: "g", kind: "minimum", icon: <Leaf className="w-4 h-4" />, accent: "text-cyan-300", bar: "from-cyan-500 to-teal-400", badge: "bg-cyan-500/10" },
];

/** Day totals against the user's targets (server component; no client formatting). */
export function MacroRemainingCards({ stats }: { stats: MacroStatsData }) {
  return (
    <section aria-labelledby="macro-cards-title" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 id="macro-cards-title" className="text-sm font-bold text-zinc-200">
          Day totals and targets
        </h2>
        <span className="text-xs text-zinc-400">Targets come from your profile settings</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {CARDS.map((card) => {
          const { consumed, target } = stats[card.key];
          const status = macroGoalStatus(consumed, target, card.kind);
          const remaining = Math.abs(status.remaining);
          const barWidth = Math.min(100, status.percent ?? 0);

          let badge: React.ReactNode;
          if (status.state === "no_target") {
            badge = <span className="text-xs text-zinc-400">No target set</span>;
          } else if (status.state === "over") {
            badge = (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/25 text-xs font-semibold text-amber-300">
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {formatAmount(remaining)} {card.unit} over
              </span>
            );
          } else if (status.state === "met") {
            badge = (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Goal met
              </span>
            );
          } else {
            badge = (
              <span className="text-xs font-semibold text-zinc-300">
                {formatAmount(remaining)} {card.unit} left
              </span>
            );
          }

          return (
            <div
              key={card.key}
              className={`p-4 rounded-2xl bg-zinc-900/80 border border-white/8 flex flex-col justify-between gap-3 ${card.key === "calories" ? "col-span-2 lg:col-span-1" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className={`p-1.5 rounded-lg ${card.badge} ${card.accent}`} aria-hidden="true">
                    {card.icon}
                  </span>
                  <span className="text-sm font-semibold text-zinc-200">{card.name}</span>
                </div>
                {badge}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white tabular-nums">{formatAmount(consumed)}</span>
                <span className="text-sm text-zinc-400 tabular-nums">
                  {status.state === "no_target" ? card.unit : `/ ${formatAmount(target)} ${card.unit}`}
                </span>
              </div>

              <div className="space-y-1.5">
                <div
                  className="w-full h-2 bg-zinc-950/80 rounded-full overflow-hidden border border-white/5"
                  role="progressbar"
                  aria-label={`${card.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={barWidth}
                >
                  <div className={`h-full bg-linear-to-r ${card.bar} rounded-full`} style={{ width: `${barWidth}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400 tabular-nums">
                  <span className="font-semibold text-zinc-300">{status.percent === null ? "-" : `${status.percent}%`}</span>
                  {card.kcalPerUnit ? <span>{formatAmount(Math.round(consumed * card.kcalPerUnit))} kcal</span> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default MacroRemainingCards;
