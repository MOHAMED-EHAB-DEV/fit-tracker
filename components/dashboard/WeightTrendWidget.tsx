"use client";

import { useCallback, useId, useMemo, useRef } from "react";
import Link from "next/link";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { AreaClosed, Bar, Line, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { LinearGradient } from "@visx/gradient";
import { TooltipWithBounds, defaultStyles, useTooltip } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { ChevronRight, Minus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { fromKg, type WeightUnit } from "@/lib/fitness/units";
import { formatDateString } from "@/lib/time";
import { weightChange, weightChangeTone, type WeightPoint } from "@/lib/dashboard/weight";

export interface WeightTrendWidgetProps {
  /** buildWeightHistory(...) from "@/lib/dashboard/weight": oldest first, kg, real dates. */
  history: WeightPoint[];
  /** fitnessProfile.weightKg (null when unknown). */
  currentWeightKg: number | null;
  goal: "cut" | "maintain" | "bulk" | null;
}

/** @deprecated Use WeightPoint from "@/lib/dashboard/weight". */
export type IWeightDataPoint = WeightPoint;

const TAP_SLOP_PX = 10;

function WeightTrendChartInner({ width, height, history, unit }: { width: number; height: number; history: WeightPoint[]; unit: WeightUnit }) {
  const gradientId = useId();
  const margin = useMemo(() => ({ top: 8, right: 10, bottom: 20, left: 34 }), []);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const { tooltipData, tooltipLeft = 0, tooltipTop = 0, tooltipOpen, showTooltip, hideTooltip } = useTooltip<WeightPoint>();

  const values = history.map((h) => fromKg(h.weightKg, unit, 1));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(0.6, (rawMax - rawMin) * 0.12);

  const first = history[0].timestamp;
  const last = history[history.length - 1].timestamp;
  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [first, last === first ? first + 86_400_000 : last], range: [0, innerWidth] }),
    [first, last, innerWidth]
  );
  const yScale = useMemo(
    () => scaleLinear<number>({ domain: [rawMin - pad, rawMax + pad], range: [innerHeight, 0] }),
    [rawMin, rawMax, pad, innerHeight]
  );
  const y = useCallback((p: WeightPoint) => yScale(fromKg(p.weightKg, unit, 1)), [unit, yScale]);

  const spansYears = history[0].dateString.slice(0, 4) !== history[history.length - 1].dateString.slice(0, 4);
  const label = (p: WeightPoint) =>
    formatDateString(p.dateString, spansYears ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" });

  const nearest = useCallback(
    (x: number): WeightPoint | null => {
      const t = xScale.invert(x - margin.left);
      let best: WeightPoint | null = null;
      for (const p of history) if (!best || Math.abs(p.timestamp - t) < Math.abs(best.timestamp - t)) best = p;
      return best;
    },
    [history, margin.left, xScale]
  );
  const showFor = useCallback(
    (p: WeightPoint | null) => {
      if (!p) return hideTooltip();
      showTooltip({ tooltipData: p, tooltipLeft: margin.left + xScale(p.timestamp), tooltipTop: margin.top + y(p) });
    },
    [hideTooltip, margin.left, margin.top, showTooltip, xScale, y]
  );

  if (width < 40 || height < 40) return null;

  const tickCount = innerWidth < 300 ? 3 : 5;
  const step = Math.max(1, Math.ceil(history.length / tickCount));
  const ticks = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <defs>
          <LinearGradient id={gradientId} from="#10b981" to="#10b981" fromOpacity={0.35} toOpacity={0} />
        </defs>
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={innerWidth} stroke="#27272a" strokeDasharray="3 3" numTicks={3} />
          <AreaClosed data={history} x={(p) => xScale(p.timestamp)} y={y} yScale={yScale} curve={curveMonotoneX} fill={`url(#${gradientId})`} />
          <LinePath data={history} x={(p) => xScale(p.timestamp)} y={y} curve={curveMonotoneX} stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" />
          {history.length <= 30 &&
            history.map((p) => <circle key={p.timestamp} cx={xScale(p.timestamp)} cy={y(p)} r={2.5} fill="#10b981" pointerEvents="none" />)}
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickValues={ticks.map((p) => p.timestamp)}
            stroke="#27272a"
            tickStroke="transparent"
            tickFormat={(val) => {
              const p = history.find((h) => h.timestamp === Number(val));
              return p ? label(p) : "";
            }}
            tickLabelProps={() => ({ fill: "#a1a1aa", fontSize: 11, textAnchor: "middle", dy: 4 })}
          />
          <AxisLeft
            scale={yScale}
            numTicks={3}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(val) => `${Math.round(Number(val))}`}
            tickLabelProps={() => ({ fill: "#a1a1aa", fontSize: 11, textAnchor: "end", dx: -4, dy: 3 })}
          />
          {tooltipOpen && tooltipData && (
            <g pointerEvents="none">
              <Line from={{ x: xScale(tooltipData.timestamp), y: 0 }} to={{ x: xScale(tooltipData.timestamp), y: innerHeight }} stroke="#3f3f46" strokeDasharray="3 3" />
              <circle cx={xScale(tooltipData.timestamp)} cy={y(tooltipData)} r={4} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
            </g>
          )}
          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            style={{ touchAction: "pan-y" }}
            onPointerMove={(e) => {
              if (e.pointerType !== "mouse") return;
              const p = localPoint(e);
              showFor(p ? nearest(p.x) : null);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") hideTooltip();
            }}
            onPointerDown={(e) => {
              pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            }}
            onPointerUp={(e) => {
              const start = pointerStart.current;
              pointerStart.current = null;
              if (!start || start.id !== e.pointerId || e.pointerType === "mouse") return;
              if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP_PX) return;
              const p = localPoint(e);
              showFor(p ? nearest(p.x) : null);
            }}
          />
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "rgba(24, 24, 27, 0.95)",
            border: "1px solid rgb(39, 39, 42)",
            borderRadius: "1rem",
            color: "white",
            padding: "0.5rem 0.75rem",
            pointerEvents: "none",
          }}
        >
          <div className="text-zinc-400 text-xs">
            {formatDateString(tooltipData.dateString, { month: "short", day: "numeric", year: "numeric" })}
          </div>
          <div className="font-extrabold text-white text-sm tabular-nums">
            {fromKg(tooltipData.weightKg, unit, 1)} {unit}
          </div>
          {tooltipData.bodyFatPercent !== null && (
            <div className="text-amber-400 text-xs font-semibold tabular-nums">{tooltipData.bodyFatPercent}% body fat</div>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}

const TONE_CLASS = { good: "text-emerald-400", off: "text-amber-400", neutral: "text-zinc-200" } as const;

export function WeightTrendWidget({ history, currentWeightKg, goal }: WeightTrendWidgetProps) {
  const headingId = useId();
  const { weightUnit: unit } = useUser();
  const latestKg = currentWeightKg ?? (history.length > 0 ? history[history.length - 1].weightKg : null);
  const change = weightChange(history);
  const tone = change ? weightChangeTone(change.deltaKg, goal) : "neutral";
  const delta = change ? fromKg(change.deltaKg, unit, 1) : null;
  const ChangeIcon = delta === null || delta === 0 ? Minus : delta < 0 ? TrendingDown : TrendingUp;

  return (
    <section aria-labelledby={headingId} className="p-4 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-4 flex flex-col">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div aria-hidden="true" className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Scale className="w-4 h-4" />
          </div>
          <h3 id={headingId} className="font-bold text-base text-white">
            Body weight trend
          </h3>
        </div>
        <Link
          href="/body-comp"
          className="min-h-11 flex items-center gap-1 px-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition rounded"
        >
          <span>Check-ins</span>
          <ChevronRight aria-hidden="true" className="w-4 h-4" />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <article className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <h4 className="text-xs uppercase font-bold text-zinc-400">Current weight</h4>
          <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5 tabular-nums">
            {latestKg !== null ? `${fromKg(latestKg, unit, 1)} ${unit}` : "—"}
          </p>
        </article>
        <article className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <h4 className="text-xs uppercase font-bold text-zinc-400">
            {change ? `Change over ${change.days} day${change.days === 1 ? "" : "s"}` : "Change"}
          </h4>
          {delta !== null ? (
            <p className={`flex items-center gap-1 text-lg sm:text-xl font-extrabold mt-0.5 tabular-nums ${TONE_CLASS[tone]}`}>
              <ChangeIcon aria-hidden="true" className="w-4 h-4 shrink-0" />
              {delta > 0 ? "+" : ""}
              {delta} {unit}
            </p>
          ) : (
            <p className="text-sm text-zinc-400 mt-1">Needs 2 weigh-ins</p>
          )}
        </article>
      </div>

      {history.length < 2 ? (
        <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl space-y-1">
          <Scale aria-hidden="true" className="w-6 h-6 text-zinc-400 mx-auto" />
          <p className="text-sm text-zinc-400 font-medium">Log 2 or more weigh-ins to see your trend</p>
        </div>
      ) : (
        <figure
          aria-label={`Body weight over ${change?.days ?? 0} days: from ${fromKg(history[0].weightKg, unit, 1)} to ${fromKg(history[history.length - 1].weightKg, unit, 1)} ${unit}`}
          className="h-44 w-full pt-1"
        >
          <ParentSize debounceTime={10}>
            {({ width, height }) => <WeightTrendChartInner width={width} height={height} history={history} unit={unit} />}
          </ParentSize>
        </figure>
      )}
    </section>
  );
}

export default WeightTrendWidget;
