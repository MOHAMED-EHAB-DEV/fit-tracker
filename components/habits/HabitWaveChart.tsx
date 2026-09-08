"use client";

import React, { useId, useMemo, useCallback, useState, useRef } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { AreaClosed, LinePath, Bar, Line } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { LinearGradient } from "@visx/gradient";
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Activity, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export interface IHabitHistoryPoint {
  dateString: string;
  dayLabel: string;
  fullDateLabel?: string;
  completedCount: number;
  totalHabits: number;
}

interface HabitWaveChartProps {
  data: IHabitHistoryPoint[];
  viewMode: "week" | "month";
  offset: number; // 0 = current, 1 = prev 1, etc.
  onViewModeChange: (mode: "week" | "month") => void;
  onOffsetChange: (offset: number) => void;
  title?: string;
  selectedDate?: string;
  onSelectDate?: (dateString: string) => void;
  todayStr?: string;
}

interface InnerChartProps {
  width: number;
  height: number;
  data: IHabitHistoryPoint[];
  maxHabits: number;
  selectedDate?: string;
  todayStr: string;
  onSelectDate?: (dateString: string) => void;
  onFutureDateClick?: (dateString: string) => void;
}

function HabitWaveInnerChart({
  width,
  height,
  data,
  maxHabits,
  selectedDate,
  todayStr,
  onSelectDate,
  onFutureDateClick,
}: InnerChartProps) {
  const gradientId = useId();

  // Compact, snug margins: ensure no wasted space
  const margin = useMemo(
    () => ({ top: 12, right: 16, bottom: 28, left: 16 }),
    []
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const {
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<IHabitHistoryPoint>();

  const effectiveMax = Math.max(1, maxHabits);

  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(1, data.length - 1)],
        range: [0, innerWidth],
      }),
    [data.length, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, effectiveMax],
        range: [innerHeight, 0],
        nice: true,
      }),
    [effectiveMax, innerHeight]
  );

  const selectedIndex = useMemo(() => {
    if (!selectedDate) return -1;
    return data.findIndex((d) => d.dateString === selectedDate);
  }, [data, selectedDate]);

  const handlePointer = useCallback(
    (
      event:
        | React.PointerEvent<SVGRectElement>
        | React.MouseEvent<SVGRectElement>
        | React.TouchEvent<SVGRectElement>
    ) => {
      const point = localPoint(event as any);
      if (!point) return;
      const x = point.x - margin.left;
      if (x < 0 || x > innerWidth) {
        hideTooltip();
        return;
      }
      const rawIdx = xScale.invert(x);
      const index = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)));
      const d = data[index];
      if (!d) return;

      // Disallow inspecting future days
      if (d.dateString > todayStr) {
        hideTooltip();
        return;
      }

      showTooltip({
        tooltipData: d,
        tooltipLeft: margin.left + xScale(index),
        tooltipTop: margin.top + yScale(d.completedCount),
      });
    },
    [data, innerWidth, margin.left, margin.top, showTooltip, hideTooltip, xScale, yScale, todayStr]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>) => {
      const point = localPoint(event as any);
      if (!point) return;
      const x = point.x - margin.left;
      if (x < 0 || x > innerWidth) return;
      const rawIdx = xScale.invert(x);
      const index = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)));
      const d = data[index];
      if (!d) return;

      if (d.dateString > todayStr) {
        onFutureDateClick?.(d.dateString);
        return;
      }

      onSelectDate?.(d.dateString);
    },
    [data, innerWidth, margin.left, onSelectDate, onFutureDateClick, xScale, todayStr]
  );

  if (width < 50 || height < 50 || data.length === 0) return null;

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <LinearGradient
            id={gradientId}
            from="#10b981"
            to="#10b981"
            fromOpacity={0.4}
            toOpacity={0.0}
          />
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Subtle Grid Horizontal Lines */}
          {[0, Math.ceil(effectiveMax / 2), effectiveMax].map((tickVal, i) => {
            const y = yScale(tickVal);
            return (
              <g key={i}>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={y}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Area Closed Wave */}
          <AreaClosed<IHabitHistoryPoint>
            data={data}
            x={(_, i) => xScale(i)}
            y={(d) => yScale(d.completedCount)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill={`url(#${gradientId})`}
          />

          {/* Wave Path Line with emerald stroke */}
          <LinePath<IHabitHistoryPoint>
            data={data}
            x={(_, i) => xScale(i)}
            y={(d) => yScale(d.completedCount)}
            curve={curveMonotoneX}
            stroke="#10b981"
            strokeWidth={2.5}
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Individual Day Point Circles */}
          {data.length <= 14 &&
            data.map((d, i) => {
              const isFuture = d.dateString > todayStr;
              const cx = xScale(i);
              const cy = yScale(d.completedCount);
              const isSelected = selectedDate === d.dateString;
              const isHovered = !isFuture && tooltipData?.dateString === d.dateString;
              return (
                <circle
                  key={d.dateString}
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 5.5 : isHovered ? 5 : 3.5}
                  fill={
                    isFuture
                      ? "#27272a"
                      : isSelected
                      ? "#34d399"
                      : d.completedCount > 0
                      ? "#10b981"
                      : "#3f3f46"
                  }
                  stroke={isSelected ? "#ffffff" : isFuture ? "#18181b" : "#09090b"}
                  strokeWidth={isSelected ? 2.5 : 2}
                  opacity={isFuture ? 0.35 : 1}
                  className="transition-all duration-150 pointer-events-none"
                />
              );
            })}

          {/* Selected Date Indicator Line & Point */}
          {selectedIndex >= 0 && (
            <g pointerEvents="none">
              <Line
                from={{ x: xScale(selectedIndex), y: 0 }}
                to={{ x: xScale(selectedIndex), y: innerHeight }}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <circle
                cx={xScale(selectedIndex)}
                cy={yScale(data[selectedIndex].completedCount)}
                r={6}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Tooltip Cursor Line & Point */}
          {tooltipOpen && tooltipData && tooltipData.dateString !== selectedDate && (
            <g pointerEvents="none">
              <Line
                from={{ x: tooltipLeft - margin.left, y: 0 }}
                to={{ x: tooltipLeft - margin.left, y: innerHeight }}
                stroke="#10b981"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.7}
              />
              <circle
                cx={tooltipLeft - margin.left}
                cy={tooltipTop - margin.top}
                r={6}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Bottom X-Axis Day Labels: reveal all days with click-to-select */}
          {data.map((item, idx) => {
            const x = xScale(idx);
            const isFuture = item.dateString > todayStr;
            const isHovered = !isFuture && tooltipData?.dateString === item.dateString;
            const isSelected = selectedDate === item.dateString;
            const isMonthMode = data.length > 14;
            const fontSize = isMonthMode ? (innerWidth < 600 ? 8.5 : 10) : 11;
            return (
              <g
                key={item.dateString || idx}
                onClick={() => {
                  if (isFuture) {
                    onFutureDateClick?.(item.dateString);
                  } else {
                    onSelectDate?.(item.dateString);
                  }
                }}
                className={isFuture ? "cursor-not-allowed opacity-35" : "cursor-pointer"}
              >
                {isSelected && (
                  <circle
                    cx={x}
                    cy={innerHeight + 24}
                    r={2}
                    fill="#10b981"
                  />
                )}
                <text
                  x={x}
                  y={innerHeight + 18}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight={isSelected ? 800 : isHovered ? 700 : 500}
                  fill={
                    isSelected
                      ? "#34d399"
                      : isFuture
                      ? "#52525b"
                      : isHovered
                      ? "#10b981"
                      : isMonthMode
                      ? "#a1a1aa"
                      : "#71717a"
                  }
                >
                  {item.dayLabel}
                </text>
              </g>
            );
          })}

          {/* Transparent Overlay for Hover Tracking & Clicking */}
          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={hideTooltip}
            onTouchMove={handlePointer}
            onTouchEnd={(e) => {
              handleClick(e);
              hideTooltip();
            }}
            onClick={handleClick}
            className="cursor-pointer"
          />
        </Group>
      </svg>

      {/* Floating Tooltip */}
      {tooltipOpen && tooltipData && (
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
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.8), 0 0 15px 0 rgba(16, 185, 129, 0.15)",
            backdropFilter: "blur(8px)",
            pointerEvents: "none",
          }}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-400 font-medium">
              <span>{tooltipData.fullDateLabel || tooltipData.dayLabel}</span>
              <span className="font-mono text-zinc-500">{tooltipData.dateString}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="font-extrabold text-sm text-white">
                {tooltipData.completedCount}
                <span className="text-zinc-500 font-normal text-xs ms-1">
                  / {tooltipData.totalHabits} done
                </span>
              </span>
              {tooltipData.totalHabits > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 ms-auto">
                  {Math.round((tooltipData.completedCount / tooltipData.totalHabits) * 100)}%
                </span>
              )}
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
  title = "Habit Consistency Trends",
  selectedDate,
  onSelectDate,
  todayStr,
}: HabitWaveChartProps) {
  const { toast } = useToast();

  const effectiveToday = useMemo(() => todayStr || format(new Date(), "yyyy-MM-dd"), [todayStr]);

  const handleFutureDateClick = useCallback((_dateStr: string) => {
    toast("Cannot inspect future days", "error", 2600);
  }, [toast]);

  const maxHabits = useMemo(() => {
    return Math.max(...data.map((d) => Math.max(d.totalHabits, d.completedCount)), 1);
  }, [data]);

  const totalCompletedInRange = useMemo(() => {
    return data.reduce((sum, d) => sum + d.completedCount, 0);
  }, [data]);

  const totalPossible = useMemo(() => {
    return data.reduce((sum, d) => sum + d.totalHabits, 0);
  }, [data]);

  const completionPct = totalPossible > 0 ? Math.round((totalCompletedInRange / totalPossible) * 100) : 0;

  return (
    <div className="relative p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 shadow-lg shadow-zinc-950/20 flex flex-col justify-between">
      {/* Header with Title, Period Switchers, & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/60">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
              {title}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              {completionPct}% completion
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>
              {totalCompletedInRange} habits checked across this{" "}
              {viewMode === "week" ? "week (Sat – Fri)" : "month (Day 1 – End)"}
            </span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <span className="text-emerald-400/90 text-[11px] font-medium">
              Click any date on chart to inspect habits
            </span>
          </p>
        </div>

        {/* Switchers & Navigation */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Prev / Next period navigation */}
          <div className="flex items-center bg-zinc-800/70 border border-zinc-700/60 rounded-xl p-0.5">
            <button
              onClick={() => onOffsetChange(offset + 1)}
              title={viewMode === "week" ? "Previous week" : "Previous month"}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-semibold text-zinc-300 select-none">
              {offset === 0
                ? (viewMode === "week" ? "This Week" : "This Month")
                : offset === 1
                ? (viewMode === "week" ? "Prev Week" : "Prev Month")
                : `${offset} ${viewMode}s ago`}
            </span>
            <button
              onClick={() => onOffsetChange(Math.max(0, offset - 1))}
              disabled={offset === 0}
              title={viewMode === "week" ? "Next week" : "Next month"}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Week vs Month pill selector */}
          <div className="flex items-center bg-zinc-800/70 border border-zinc-700/60 rounded-xl p-0.5">
            <button
              onClick={() => onViewModeChange("week")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer",
                viewMode === "week"
                  ? "bg-emerald-500 text-zinc-950 shadow-xs"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Week
            </button>
            <button
              onClick={() => onViewModeChange("month")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer",
                viewMode === "month"
                  ? "bg-emerald-500 text-zinc-950 shadow-xs"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full h-56 sm:h-64 mt-3">
        <ParentSize>
          {({ width, height }) => (
            <HabitWaveInnerChart
              width={width}
              height={height}
              data={data}
              maxHabits={maxHabits}
              selectedDate={selectedDate}
              todayStr={effectiveToday}
              onSelectDate={onSelectDate}
              onFutureDateClick={handleFutureDateClick}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}
