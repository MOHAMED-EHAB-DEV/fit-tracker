"use client";

import React, { useCallback, useId, useMemo, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { AreaClosed, Bar, Line, LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { LinearGradient } from "@visx/gradient";
import { TooltipWithBounds, defaultStyles, useTooltip } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { Activity, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { summarizeCompletion, type HabitDayPoint } from "@/lib/habits/completion";

export interface HabitChartPoint extends HabitDayPoint {
  dayLabel: string;
  fullDateLabel: string;
}

/** @deprecated Use HabitChartPoint. */
export type IHabitHistoryPoint = HabitChartPoint;

interface HabitWaveChartProps {
  data: HabitChartPoint[];
  viewMode: "week" | "month";
  offset: number;
  onViewModeChange: (mode: "week" | "month") => void;
  onOffsetChange: (offset: number) => void;
  /** e.g. "Sat – Fri" or "November 2026". */
  periodLabel: string;
  title?: string;
  selectedDate?: string;
  onSelectDate?: (dateString: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

interface InnerChartProps {
  width: number;
  height: number;
  data: HabitChartPoint[];
  maxHabits: number;
  selectedDate?: string;
  onSelectDate?: (dateString: string) => void;
}

/** A tap moves at most this many px between pointerdown and pointerup. */
const TAP_SLOP_PX = 10;

function HabitWaveInnerChart({ width, height, data, maxHabits, selectedDate, onSelectDate }: InnerChartProps) {
  const gradientId = useId();
  const glowId = useId();
  const margin = useMemo(() => ({ top: 12, right: 16, bottom: 28, left: 16 }), []);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);

  const { tooltipData, tooltipLeft = 0, tooltipTop = 0, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<HabitChartPoint>();

  const effectiveMax = Math.max(1, maxHabits);
  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [0, Math.max(1, data.length - 1)], range: [0, innerWidth] }),
    [data.length, innerWidth]
  );
  const yScale = useMemo(
    () => scaleLinear<number>({ domain: [0, effectiveMax], range: [innerHeight, 0], nice: true }),
    [effectiveMax, innerHeight]
  );

  // Elapsed days only: the line stops at today instead of dropping to zero.
  const elapsed = useMemo(
    () =>
      data
        .map((d, index) => ({ d, index }))
        .filter((p): p is { d: HabitChartPoint & { completedCount: number }; index: number } => !p.d.isFuture && p.d.completedCount !== null),
    [data]
  );
  const selectedIndex = selectedDate ? data.findIndex((d) => d.dateString === selectedDate) : -1;
  const selectedPoint = selectedIndex >= 0 ? data[selectedIndex] : null;

  const indexAt = useCallback(
    (clientX: number): number | null => {
      const x = clientX - margin.left;
      if (x < 0 || x > innerWidth || data.length === 0) return null;
      return Math.max(0, Math.min(data.length - 1, Math.round(xScale.invert(x))));
    },
    [data.length, innerWidth, margin.left, xScale]
  );

  const showAt = useCallback(
    (index: number) => {
      const d = data[index];
      if (!d || d.isFuture || d.completedCount === null) {
        hideTooltip();
        return;
      }
      showTooltip({
        tooltipData: d,
        tooltipLeft: margin.left + xScale(index),
        tooltipTop: margin.top + yScale(d.completedCount),
      });
    },
    [data, hideTooltip, margin.left, margin.top, showTooltip, xScale, yScale]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (event.pointerType !== "mouse") return;
      const point = localPoint(event);
      const index = point ? indexAt(point.x) : null;
      if (index === null) hideTooltip();
      else showAt(index);
    },
    [hideTooltip, indexAt, showAt]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start || start.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) return;
      const point = localPoint(event);
      const index = point ? indexAt(point.x) : null;
      if (index === null) return;
      const d = data[index];
      if (!d || d.isFuture) return;
      showAt(index);
      onSelectDate?.(d.dateString);
    },
    [data, indexAt, onSelectDate, showAt]
  );

  if (width < 50 || height < 50 || data.length === 0) return null;
  const isMonthMode = data.length > 14;

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <defs>
          <LinearGradient id={gradientId} from="#10b981" to="#10b981" fromOpacity={0.4} toOpacity={0} />
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <Group left={margin.left} top={margin.top}>
          {[0, Math.ceil(effectiveMax / 2), effectiveMax].map((tick, i) => (
            <line key={i} x1={0} x2={innerWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="#27272a" strokeDasharray="3 3" />
          ))}

          {elapsed.length > 0 && (
            <>
              <AreaClosed
                data={elapsed}
                x={(p) => xScale(p.index)}
                y={(p) => yScale(p.d.completedCount)}
                yScale={yScale}
                curve={curveMonotoneX}
                fill={`url(#${gradientId})`}
              />
              <LinePath
                data={elapsed}
                x={(p) => xScale(p.index)}
                y={(p) => yScale(p.d.completedCount)}
                curve={curveMonotoneX}
                stroke="#10b981"
                strokeWidth={2.5}
                strokeLinecap="round"
                filter={`url(#${glowId})`}
              />
            </>
          )}

          {!isMonthMode &&
            elapsed.map(({ d, index }) => (
              <circle
                key={d.dateString}
                cx={xScale(index)}
                cy={yScale(d.completedCount)}
                r={selectedDate === d.dateString ? 5.5 : 3.5}
                fill={selectedDate === d.dateString ? "#34d399" : d.completedCount > 0 ? "#10b981" : "#52525b"}
                stroke={selectedDate === d.dateString ? "#ffffff" : "#09090b"}
                strokeWidth={2}
                pointerEvents="none"
              />
            ))}

          {selectedPoint && selectedPoint.completedCount !== null && (
            <g pointerEvents="none">
              <Line
                from={{ x: xScale(selectedIndex), y: 0 }}
                to={{ x: xScale(selectedIndex), y: innerHeight }}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <circle cx={xScale(selectedIndex)} cy={yScale(selectedPoint.completedCount)} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
            </g>
          )}

          {data.map((item, idx) => {
            const isSelected = selectedDate === item.dateString;
            return (
              <text
                key={item.dateString}
                x={xScale(idx)}
                y={innerHeight + 18}
                textAnchor="middle"
                fontSize={isMonthMode ? (innerWidth < 600 ? 9 : 10) : 12}
                fontWeight={isSelected ? 800 : 500}
                fill={isSelected ? "#34d399" : item.isFuture ? "#52525b" : "#a1a1aa"}
                pointerEvents="none"
              >
                {isMonthMode && innerWidth < 600 && idx % 2 === 1 && !isSelected ? "" : item.dayLabel}
              </text>
            );
          })}

          <Bar
            x={0}
            y={-margin.top}
            width={innerWidth}
            height={innerHeight + margin.top + margin.bottom}
            fill="transparent"
            style={{ touchAction: "pan-y" }}
            onPointerMove={handlePointerMove}
            onPointerLeave={hideTooltip}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              pointerStart.current = null;
            }}
            className="cursor-pointer"
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && tooltipData.completedCount !== null && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "rgba(9, 9, 11, 0.95)",
            color: "#ffffff",
            padding: "8px 12px",
            borderRadius: "14px",
            border: "1px solid rgba(39, 39, 42, 0.9)",
            pointerEvents: "none",
          }}
        >
          <div className="space-y-1">
            <div className="text-xs text-zinc-400 font-medium">{tooltipData.fullDateLabel}</div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">
                {tooltipData.completedCount}
                <span className="text-zinc-400 font-normal text-xs ms-1">/ {tooltipData.totalHabits} done</span>
              </span>
              {tooltipData.totalHabits ? (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 ms-auto">
                  {Math.round((tooltipData.completedCount / tooltipData.totalHabits) * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function HabitWaveChart({
  data,
  viewMode,
  offset,
  onViewModeChange,
  onOffsetChange,
  periodLabel,
  title = "Habit Consistency Trends",
  selectedDate,
  onSelectDate,
  loading = false,
  error = null,
  onRetry,
}: HabitWaveChartProps) {
  const summary = useMemo(() => summarizeCompletion(data), [data]);
  const maxHabits = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.totalHabits ?? 0, d.completedCount ?? 0))),
    [data]
  );

  const unit = viewMode === "week" ? "week" : "month";
  const offsetLabel =
    offset === 0 ? `This ${unit}` : offset === 1 ? `Last ${unit}` : `${offset} ${unit}s ago`;

  return (
    <section
      aria-label={title}
      className="relative p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 shadow-lg flex flex-col"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Activity className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">{title}</h3>
            {summary.percent !== null && !loading && !error && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                {summary.percent}% completion
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {summary.elapsedDays > 0
              ? `${summary.completed} of ${summary.possible} check-ins over ${summary.elapsedDays} day${summary.elapsedDays === 1 ? "" : "s"} so far (${periodLabel})`
              : `No days to show yet (${periodLabel})`}
            <span className="hidden sm:inline"> · Tap a day on the chart to inspect it</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-zinc-800/70 border border-zinc-700/60 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => onOffsetChange(offset + 1)}
              aria-label={`Previous ${unit}`}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="px-1.5 text-xs font-semibold text-zinc-300 select-none min-w-20 text-center" aria-live="polite">
              {offsetLabel}
            </span>
            <button
              type="button"
              onClick={() => onOffsetChange(Math.max(0, offset - 1))}
              disabled={offset === 0}
              aria-label={`Next ${unit}`}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div role="group" aria-label="Chart period" className="flex items-center bg-zinc-800/70 border border-zinc-700/60 rounded-xl p-0.5">
            {(["week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  "min-h-11 px-3 text-xs font-bold rounded-lg transition cursor-pointer capitalize",
                  viewMode === mode ? "bg-emerald-500 text-zinc-950" : "text-zinc-300 hover:text-white"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <figure
        className="relative w-full h-56 sm:h-64 mt-3"
        aria-label={
          summary.percent !== null
            ? `${title}: ${summary.percent}% of habits completed over ${summary.elapsedDays} days`
            : title
        }
      >
        {error ? (
          <div role="alert" className="h-full flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
            <p className="text-sm text-zinc-300">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-white cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            <ParentSize>
              {({ width, height }) => (
                <HabitWaveInnerChart
                  width={width}
                  height={height}
                  data={data}
                  maxHabits={maxHabits}
                  selectedDate={selectedDate}
                  onSelectDate={onSelectDate}
                />
              )}
            </ParentSize>
            {loading && (
              <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-zinc-900/60 rounded-2xl text-sm text-zinc-300">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" aria-hidden="true" />
                <span>Loading history…</span>
              </div>
            )}
          </>
        )}
      </figure>
    </section>
  );
}
