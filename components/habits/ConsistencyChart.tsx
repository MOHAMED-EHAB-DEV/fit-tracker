"use client";

import React from "react";
import { Surface } from "@/components/ui/Surface";
import { CHART_COLORS, CHART_STROKE } from "@/lib/ui/chart-theme";
import { formatDateString } from "@/lib/time";
import type { HabitDayPoint } from "@/lib/habits/completion";

const TARGET = 0.8;
const HEIGHT = 112;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 90;

interface ConsistencyChartProps {
  /** One point per day, oldest first (the last one is today). */
  points: HabitDayPoint[];
  /** Overall share of habits done over the period, 0-100 (null when nothing counted). */
  percent: number | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Tap a bar to log that day. */
  onSelectDate?: (dateString: string) => void;
  selectedDate?: string;
}

/**
 * Daily habit completion over the last 14 days: one bar per day (today in
 * accent, strong days in ink), with a dashed 80% line.
 */
export function ConsistencyChart({ points, percent, loading = false, error = null, onRetry, onSelectDate, selectedDate }: ConsistencyChartProps) {
  const count = Math.max(points.length, 1);
  const slot = 328 / count;
  const barWidth = Math.min(14, slot - 6);
  const yFor = (rate: number) => PLOT_BOTTOM - rate * (PLOT_BOTTOM - PLOT_TOP);
  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];

  return (
    <Surface as="section" aria-labelledby="consistency-title" className="p-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <div>
          <h2 id="consistency-title" className="text-[15px] font-semibold text-ink">
            {points.length}-day consistency
          </h2>
          <p className="text-xs text-ink-3">Share of your habits done each day</p>
        </div>
        <span className="font-mono text-xl font-semibold tabular-nums tracking-[-0.02em] text-ink">
          {percent === null ? "—" : `${percent}%`}
        </span>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-canvas px-3 py-2.5">
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-9 shrink-0 rounded-chip border border-line bg-elevated px-3 text-[13px] font-medium text-ink hover:border-line-strong cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"} aria-busy={loading || undefined}>
          <svg viewBox={`0 0 328 ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label={`Habit consistency over the last ${points.length} days: ${percent ?? 0}%`}>
            {points.map((point, index) =>
              selectedDate === point.dateString ? (
                <rect key={`selected-${point.dateString}`} x={index * slot + 1} y={2} width={slot - 2} height={PLOT_BOTTOM - 2} rx={3} fill={CHART_COLORS.elevated} />
              ) : null
            )}
            <line x1={0} y1={yFor(TARGET)} x2={328} y2={yFor(TARGET)} stroke={CHART_COLORS.lineStrong} strokeWidth={CHART_STROKE.grid} strokeDasharray={CHART_STROKE.targetDash} />
            <text x={328} y={yFor(TARGET) - 5} textAnchor="end" fill={CHART_COLORS.ink3} fontSize={11} className="font-mono">
              80%
            </text>
            <line x1={0} y1={PLOT_BOTTOM} x2={328} y2={PLOT_BOTTOM} stroke={CHART_COLORS.line} strokeWidth={CHART_STROKE.grid} />
            {points.map((point, index) => {
              const x = index * slot + (slot - barWidth) / 2;
              const isLast = index === points.length - 1;
              const rate =
                point.isFuture || !point.totalHabits || point.completedCount === null ? null : point.completedCount / point.totalHabits;
              const height = rate === null ? 0 : Math.max(rate > 0 ? 2 : 0, PLOT_BOTTOM - yFor(rate));
              const fill = isLast
                ? CHART_COLORS.accent
                : rate !== null && rate >= TARGET
                  ? CHART_COLORS.ink
                  : rate !== null && rate >= 0.5
                    ? CHART_COLORS.ink2
                    : CHART_COLORS.lineStrong;
              const label = `${formatDateString(point.dateString)}: ${
                rate === null ? "no habits" : `${point.completedCount} of ${point.totalHabits} done`
              }`;
              return (
                <g key={point.dateString}>
                  <rect x={x} y={PLOT_BOTTOM - height} width={barWidth} height={height} rx={2} fill={fill}>
                    <title>{label}</title>
                  </rect>
                  {onSelectDate && !point.isFuture && (
                    <rect
                      x={index * slot}
                      y={0}
                      width={slot}
                      height={PLOT_BOTTOM}
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => onSelectDate(point.dateString)}
                    >
                      <title>{label}</title>
                    </rect>
                  )}
                </g>
              );
            })}
            {first && (
              <text x={2} y={107} fill={CHART_COLORS.ink3} fontSize={11} className="font-mono">
                {formatDateString(first.dateString, { month: "short", day: "numeric" })}
              </text>
            )}
            {middle && points.length > 2 && (
              <text x={164} y={107} textAnchor="middle" fill={CHART_COLORS.ink3} fontSize={11} className="font-mono">
                {formatDateString(middle.dateString, { month: "short", day: "numeric" })}
              </text>
            )}
            <text x={328} y={107} textAnchor="end" fill={CHART_COLORS.accent} fontSize={11} fontWeight={500}>
              Today
            </text>
          </svg>
        </div>
      )}
    </Surface>
  );
}

export default ConsistencyChart;
