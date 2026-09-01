"use client";

import { useState, useId } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Flame, TrendingDown, TrendingUp } from "lucide-react";

export interface IDailyHistoryPoint {
  dayName: string; // "Sat", "Sun", etc.
  dateString: string; // "YYYY-MM-DD"
  caloriesIn: number;
  caloriesOut: number;
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  hasWorkout: boolean;
}

interface EnergyBalanceChartProps {
  data: IDailyHistoryPoint[];
  goal: "cut" | "maintain" | "bulk";
  targetCalories: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as IDailyHistoryPoint;
    const net = d.caloriesIn - d.caloriesOut;
    const isDeficit = net < 0;

    return (
      <div className="p-3.5 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-44">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
          <span className="font-bold text-white">{d.dayName}</span>
          <span className="text-zinc-500 text-[10px]">{d.dateString}</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Calories In:</span>
            </span>
            <span className="font-bold text-white tabular-nums">{d.caloriesIn.toLocaleString()} kcal</span>
          </div>

          <div className="flex justify-between items-center text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span>Calories Out:</span>
            </span>
            <span className="font-bold text-white tabular-nums">{d.caloriesOut.toLocaleString()} kcal</span>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60 font-semibold">
            <span className="text-zinc-400">Net Energy:</span>
            <span className={`tabular-nums ${isDeficit ? "text-emerald-400" : "text-amber-400"}`}>
              {isDeficit ? "" : "+"}
              {net.toLocaleString()} kcal ({isDeficit ? "Deficit" : "Surplus"})
            </span>
          </div>

          <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-1 tabular-nums">
            <span>P: {Number(d.protein).toFixed(1)}g</span>
            <span>C: {Number(d.carbs).toFixed(1)}g</span>
            <span>F: {Number(d.fat).toFixed(1)}g</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function EnergyBalanceChart({
  data,
  goal,
}: EnergyBalanceChartProps) {
  const [viewMode, setViewMode] = useState<"energy" | "macros">("energy");
  const headingId = useId();

  // Calculate 7-day totals
  const totalIn = data.reduce((sum, d) => sum + d.caloriesIn, 0);
  const totalOut = data.reduce((sum, d) => sum + d.caloriesOut, 0);
  const avgIn = Math.round(totalIn / (data.length || 1));
  const avgOut = Math.round(totalOut / (data.length || 1));
  const netWeekly = totalIn - totalOut;

  return (
    <section
      aria-labelledby={headingId}
      className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-5 flex flex-col justify-between"
    >
      {/* Semantic Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Flame className="w-4 h-4" />
            </div>
            <h3 id={headingId} className="font-bold text-base text-white">
              7-Day Energy & Caloric Flow
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Compare daily caloric intake vs total expenditure (BMR + Workouts + Steps)
          </p>
        </div>

        {/* View Toggle */}
        <div
          role="radiogroup"
          aria-label="Chart view mode"
          className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-semibold self-start sm:self-auto select-none"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "energy"}
            tabIndex={viewMode === "energy" ? 0 : -1}
            onClick={() => setViewMode("energy")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              viewMode === "energy"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Energy (kcal)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "macros"}
            tabIndex={viewMode === "macros" ? 0 : -1}
            onClick={() => setViewMode("macros")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              viewMode === "macros"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Macros (g)
          </button>
        </div>
      </header>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
        <article className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">Avg Daily In</span>
          <span className="text-base sm:text-lg font-extrabold text-white block mt-1 truncate tabular-nums">
            {avgIn.toLocaleString()} <span className="text-[11px] font-medium text-zinc-500">kcal</span>
          </span>
        </article>

        <article className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">Avg Daily Burn</span>
          <span className="text-base sm:text-lg font-extrabold text-orange-400 block mt-1 truncate tabular-nums">
            {avgOut.toLocaleString()} <span className="text-[11px] font-medium text-zinc-500">kcal</span>
          </span>
        </article>

        <article className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">7-Day Net Balance</span>
          <div className="flex items-center gap-1 mt-1 overflow-hidden">
            {netWeekly < 0 ? (
              <TrendingDown aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <TrendingUp aria-hidden="true" className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span
              aria-label={`7-day net energy: ${netWeekly < 0 ? "" : "+"}${netWeekly} kcal`}
              className={`text-base sm:text-lg font-extrabold truncate tabular-nums ${netWeekly < 0 ? "text-emerald-400" : "text-amber-400"}`}
            >
              {netWeekly < 0 ? "" : "+"}{netWeekly.toLocaleString()} <span className="text-[11px] font-medium text-zinc-500">kcal</span>
            </span>
          </div>
        </article>

        <article className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">Goal Mode</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-300 block mt-1 truncate capitalize">
            {goal === "cut" ? "Fat Loss (-500)" : goal === "bulk" ? "Muscle Gain (+300)" : "Maintenance"}
          </span>
        </article>
      </div>

      {/* Chart Canvas */}
      <figure aria-label="7-Day energy intake and expenditure chart" className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "energy" ? (
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="dayName"
                stroke="#71717a"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
              />
              <Bar
                name="Calories In"
                dataKey="caloriesIn"
                fill="#10b981"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                name="Calories Out"
                dataKey="caloriesOut"
                fill="#f97316"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
              <Line
                name="Calorie Target"
                type="monotone"
                dataKey="targetCalories"
                stroke="#a1a1aa"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={1.5}
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="dayName"
                stroke="#71717a"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="#71717a"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
              />
              <Bar
                name="Protein (g)"
                dataKey="protein"
                fill="#10b981"
                stackId="macros"
                radius={[0, 0, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                name="Carbs (g)"
                dataKey="carbs"
                fill="#eab308"
                stackId="macros"
                radius={[0, 0, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                name="Fat (g)"
                dataKey="fat"
                fill="#f97316"
                stackId="macros"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </figure>
    </section>
  );
}

export default EnergyBalanceChart;
