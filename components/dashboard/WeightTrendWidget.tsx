"use client";

import { useId } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Scale, TrendingDown, TrendingUp, ChevronRight } from "lucide-react";

export interface IWeightDataPoint {
  date: string;
  weight: number;
  bodyFatPercent?: number | null;
}

interface WeightTrendWidgetProps {
  history: IWeightDataPoint[];
  currentWeight: number | null;
  targetWeight?: number | null;
  goal: "cut" | "maintain" | "bulk";
}

const CustomWeightTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as IWeightDataPoint;
    return (
      <div className="p-2.5 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-xl backdrop-blur-md text-xs space-y-1">
        <div className="text-zinc-400 text-[10px]">{d.date}</div>
        <div className="font-extrabold text-white text-sm tabular-nums">{d.weight} kg</div>
        {d.bodyFatPercent && (
          <div className="text-amber-400 text-[10px] font-semibold tabular-nums">
            {d.bodyFatPercent}% Body Fat
          </div>
        )}
      </div>
    );
  }
  return null;
};

export function WeightTrendWidget({
  history,
  currentWeight,
  goal,
}: WeightTrendWidgetProps) {
  const headingId = useId();
  const firstEntry = history.length > 0 ? history[0].weight : currentWeight;
  const latestWeight = currentWeight || (history.length > 0 ? history[history.length - 1].weight : 75);
  const diff = firstEntry ? +(latestWeight - firstEntry).toFixed(1) : 0;
  const isLoss = diff < 0;

  // Min/Max for chart Y-Axis padding
  const weights = history.map((h) => h.weight);
  const minWeight = weights.length > 0 ? Math.floor(Math.min(...weights) - 1) : 60;
  const maxWeight = weights.length > 0 ? Math.ceil(Math.max(...weights) + 1) : 90;

  return (
    <section
      aria-labelledby={headingId}
      className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-4 flex flex-col justify-between"
    >
      {/* Semantic Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div aria-hidden="true" className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Scale className="w-4 h-4" />
          </div>
          <h3 id={headingId} className="font-bold text-base text-white">
            Body Weight & Physique Trend
          </h3>
        </div>

        <Link
          href="/body-comp"
          aria-label="View all body composition check-ins and photos"
          className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
        >
          <span>Check-Ins</span>
          <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Weight Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <article className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">Current Weight</span>
          <span className="text-lg sm:text-xl font-extrabold text-white block mt-0.5 truncate tabular-nums">
            {latestWeight ? `${latestWeight} kg` : "—"}
          </span>
        </article>

        <article className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">Period Change</span>
          <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
            {isLoss ? (
              <TrendingDown aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <TrendingUp aria-hidden="true" className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span
              aria-label={`Weight change: ${diff > 0 ? `+${diff}` : `${diff}`} kilograms`}
              className={`text-lg sm:text-xl font-extrabold truncate tabular-nums ${isLoss ? "text-emerald-400" : "text-amber-400"}`}
            >
              {diff > 0 ? `+${diff}` : `${diff}`} kg
            </span>
          </div>
        </article>

        <article className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block truncate">Goal Status</span>
          <span className="text-xs sm:text-sm font-bold text-emerald-400 block mt-1 truncate">
            {goal === "cut" ? "Fat Loss Phase" : goal === "bulk" ? "Hypertrophy Phase" : "Maintenance"}
          </span>
        </article>
      </div>

      {/* Sparkline Chart */}
      {history.length < 2 ? (
        <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl space-y-1">
          <Scale aria-hidden="true" className="w-6 h-6 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400 font-medium">Log 2 or more weigh-ins to generate your trend chart</p>
        </div>
      ) : (
        <figure aria-label="Body weight trend over time chart" className="h-44 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#71717a"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                domain={[minWeight, maxWeight]}
                stroke="#71717a"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomWeightTooltip />} />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#weightGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </figure>
      )}
    </section>
  );
}

export default WeightTrendWidget;
