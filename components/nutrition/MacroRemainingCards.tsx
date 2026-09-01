"use client";

import React from "react";
import {
  Flame,
  Target,
  Wheat,
  Droplet,
  Leaf,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

export interface MacroStatsData {
  calories: {
    consumed: number;
    target: number;
  };
  protein: {
    consumed: number;
    target: number;
  };
  carbs: {
    consumed: number;
    target: number;
  };
  fat: {
    consumed: number;
    target: number;
  };
  fiber: {
    consumed: number;
    target: number;
  };
}

interface MacroRemainingCardsProps {
  stats: MacroStatsData;
}

interface SingleMacroConfig {
  key: string;
  name: string;
  unit: string;
  consumed: number;
  target: number;
  multiplier?: number; // calories per unit
  icon: React.ReactNode;
  accentColor: string;
  barGradient: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export function MacroRemainingCards({ stats }: MacroRemainingCardsProps) {
  const macrosList: SingleMacroConfig[] = [
    {
      key: "calories",
      name: "Total Energy",
      unit: "kcal",
      consumed: stats.calories.consumed,
      target: stats.calories.target,
      icon: <Flame className="w-4 h-4" />,
      accentColor: "text-orange-400",
      barGradient: "from-orange-500 to-amber-400",
      badgeBg: "bg-orange-500/10",
      badgeText: "text-orange-400",
      borderColor: "group-hover:border-orange-500/30",
    },
    {
      key: "protein",
      name: "Protein",
      unit: "g",
      consumed: stats.protein.consumed,
      target: stats.protein.target,
      multiplier: 4,
      icon: <Target className="w-4 h-4" />,
      accentColor: "text-emerald-400",
      barGradient: "from-emerald-500 to-teal-400",
      badgeBg: "bg-emerald-500/10",
      badgeText: "text-emerald-400",
      borderColor: "group-hover:border-emerald-500/30",
    },
    {
      key: "carbs",
      name: "Carbohydrates",
      unit: "g",
      consumed: stats.carbs.consumed,
      target: stats.carbs.target,
      multiplier: 4,
      icon: <Wheat className="w-4 h-4" />,
      accentColor: "text-amber-400",
      barGradient: "from-amber-500 to-yellow-400",
      badgeBg: "bg-amber-500/10",
      badgeText: "text-amber-400",
      borderColor: "group-hover:border-amber-500/30",
    },
    {
      key: "fat",
      name: "Fats",
      unit: "g",
      consumed: stats.fat.consumed,
      target: stats.fat.target,
      multiplier: 9,
      icon: <Droplet className="w-4 h-4" />,
      accentColor: "text-rose-400",
      barGradient: "from-rose-500 to-orange-400",
      badgeBg: "bg-rose-500/10",
      badgeText: "text-rose-400",
      borderColor: "group-hover:border-rose-500/30",
    },
    {
      key: "fiber",
      name: "Dietary Fiber",
      unit: "g",
      consumed: stats.fiber.consumed,
      target: stats.fiber.target,
      icon: <Leaf className="w-4 h-4" />,
      accentColor: "text-cyan-400",
      barGradient: "from-cyan-500 to-teal-400",
      badgeBg: "bg-cyan-500/10",
      badgeText: "text-cyan-400",
      borderColor: "group-hover:border-cyan-500/30",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
            Daily Macro & Nutrient Targets
          </h2>
        </div>
        <span className="text-xs text-zinc-500 font-medium">
          Customized from your user profile settings
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {macrosList.map((m) => {
          const targetVal = Math.max(1, m.target);
          const consumedVal = Math.max(0, m.consumed);
          const percentage = Math.round((consumedVal / targetVal) * 100);
          const barWidthPct = Math.min(100, percentage);
          const remaining = targetVal - consumedVal;
          const isOver = remaining < 0;
          const isMet = percentage >= 100 && percentage <= 110;

          const isGrams = m.unit === "g";
          const formattedLeft = isGrams ? remaining.toFixed(1) : Math.round(remaining).toLocaleString();
          const formattedOver = isGrams ? Math.abs(remaining).toFixed(1) : Math.abs(Math.round(remaining)).toLocaleString();

          const energyKcal = m.multiplier ? Math.round(consumedVal * m.multiplier) : null;

          return (
            <div
              key={m.key}
              className={`p-4 sm:p-5 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-white/8 ${m.borderColor} transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-lg`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className={`p-1.5 rounded-lg ${m.badgeBg} ${m.badgeText}`}>
                      {m.icon}
                    </div>
                    <span className="text-xs font-bold text-zinc-300">
                      {m.name}
                    </span>
                  </div>

                  {isOver ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/20 text-[10px] font-extrabold text-amber-400">
                      <AlertCircle className="w-2.5 h-2.5" />
                      +{formattedOver} {m.unit} over
                    </span>
                  ) : isMet ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/20 text-[10px] font-extrabold text-emerald-400">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Goal Met
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-[10px] font-bold text-zinc-400">
                      {formattedLeft} {m.unit} left
                    </span>
                  )}
                </div>

                {/* Main Values */}
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className={`text-2xl sm:text-3xl font-black text-white tracking-tight`}>
                    {isGrams ? (Number.isInteger(consumedVal) ? consumedVal.toString() : consumedVal.toFixed(1)) : consumedVal.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-zinc-500">
                    / {isGrams ? (Number.isInteger(targetVal) ? targetVal.toString() : targetVal.toFixed(1)) : targetVal.toLocaleString()} {m.unit}
                  </span>
                </div>
              </div>

              {/* Progress Bar & Footer */}
              <div className="space-y-2 mt-auto">
                <div className="w-full h-2 bg-zinc-950/80 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full bg-linear-to-r ${m.barGradient} rounded-full transition-all duration-500`}
                    style={{ width: `${barWidthPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                  <span className="font-bold text-zinc-300">{percentage}%</span>
                  {energyKcal !== null ? (
                    <span className="text-[10px] text-zinc-500">
                      {energyKcal} kcal ({isGrams ? (Number.isInteger(consumedVal) ? consumedVal : consumedVal.toFixed(1)) : Math.round(consumedVal)}g)
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500">
                      {remaining > 0 ? `${formattedLeft} ${m.unit} to go` : "Budget reached"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
