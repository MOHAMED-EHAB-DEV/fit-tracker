"use client";

import { useState, useId, useMemo, useCallback } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { Bar, BarRounded, LinePath } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";
import { localPoint } from "@visx/event";
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

interface EnergyChartInnerProps {
  width: number;
  height: number;
  data: IDailyHistoryPoint[];
  viewMode: "energy" | "macros";
}

function EnergyBalanceChartInner({
  width,
  height,
  data,
  viewMode,
}: EnergyChartInnerProps) {
  const margin = useMemo(
    () => ({ top: 12, right: 8, bottom: 20, left: 42 }),
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
  } = useTooltip<IDailyHistoryPoint>();

  const x0Scale = useMemo(
    () =>
      scaleBand<string>({
        domain: data.map((d) => d.dayName),
        range: [0, innerWidth],
        padding: 0.16,
      }),
    [data, innerWidth]
  );

  const bandWidth = x0Scale.bandwidth();

  const yScale = useMemo(() => {
    if (viewMode === "energy") {
      const maxVal = Math.max(
        ...data.map((d) => Math.max(d.caloriesIn, d.caloriesOut, d.targetCalories || 0))
      );
      // Tight 4% headroom so highest bar is visible without excessive empty space
      const yMax = Math.max(500, Math.ceil(maxVal * 1.04));
      return scaleLinear<number>({
        domain: [0, yMax],
        range: [innerHeight, 0],
        nice: false,
      });
    } else {
      const maxVal = Math.max(
        ...data.map((d) => (d.protein || 0) + (d.carbs || 0) + (d.fat || 0))
      );
      const yMax = Math.max(50, Math.ceil(maxVal * 1.04));
      return scaleLinear<number>({
        domain: [0, yMax],
        range: [innerHeight, 0],
        nice: false,
      });
    }
  }, [data, innerHeight, viewMode]);

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
      if (x < 0 || x > innerWidth || data.length === 0) {
        hideTooltip();
        return;
      }
      const slotWidth = innerWidth / data.length;
      const index = Math.max(0, Math.min(data.length - 1, Math.floor(x / slotWidth)));
      const d = data[index];
      if (!d) return;

      const dayCenter = (x0Scale(d.dayName) ?? 0) + bandWidth / 2;
      const topY =
        viewMode === "energy"
          ? yScale(Math.max(d.caloriesIn, d.caloriesOut, d.targetCalories || 0))
          : yScale((d.protein || 0) + (d.carbs || 0) + (d.fat || 0));

      showTooltip({
        tooltipData: d,
        tooltipLeft: margin.left + dayCenter,
        tooltipTop: margin.top + Math.max(0, topY),
      });
    },
    [data, innerWidth, margin.left, margin.top, showTooltip, hideTooltip, x0Scale, bandWidth, viewMode, yScale]
  );

  if (width < 40 || height < 40) return null;

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke="#27272a"
            strokeDasharray="3 3"
            numTicks={4}
          />

          {/* Hover Column Spotlight Background */}
          {data.map((d) => {
            const slotX = x0Scale(d.dayName) ?? 0;
            const isHovered = tooltipOpen && tooltipData?.dayName === d.dayName;
            return (
              <rect
                key={`spotlight-${d.dayName}`}
                x={slotX - 3}
                y={0}
                width={bandWidth + 6}
                height={innerHeight}
                rx={6}
                fill={isHovered ? "rgba(255, 255, 255, 0.04)" : "transparent"}
                pointerEvents="none"
              />
            );
          })}

          {/* Render Bars Based on View Mode */}
          {viewMode === "energy" ? (
            <>
              {data.map((d) => {
                const dayX = x0Scale(d.dayName) ?? 0;
                const barGap = Math.max(2, Math.min(4, Math.round(bandWidth * 0.05)));
                const barWidth = Math.max(6, Math.min(36, Math.floor((bandWidth - barGap) / 2)));
                const totalGroupWidth = barWidth * 2 + barGap;
                const groupOffset = (bandWidth - totalGroupWidth) / 2;

                // Calories In Bar
                const inX = dayX + groupOffset;
                const inY = yScale(d.caloriesIn);
                const inHeight = Math.max(0, innerHeight - inY);

                // Calories Out Bar
                const outX = inX + barWidth + barGap;
                const outY = yScale(d.caloriesOut);
                const outHeight = Math.max(0, innerHeight - outY);

                const radius = Math.min(5, barWidth / 2);

                return (
                  <g key={`energy-bars-${d.dayName}`}>
                    {inHeight > 0 && (
                      <BarRounded
                        x={inX}
                        y={inY}
                        width={barWidth}
                        height={inHeight}
                        top
                        radius={radius}
                        fill="#10b981"
                      />
                    )}
                    {outHeight > 0 && (
                      <BarRounded
                        x={outX}
                        y={outY}
                        width={barWidth}
                        height={outHeight}
                        top
                        radius={radius}
                        fill="#f97316"
                      />
                    )}
                  </g>
                );
              })}

              {/* Target Calories Dashed Guideline */}
              <LinePath<IDailyHistoryPoint>
                data={data}
                x={(d) => (x0Scale(d.dayName) ?? 0) + bandWidth / 2}
                y={(d) => yScale(d.targetCalories)}
                stroke="#a1a1aa"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </>
          ) : (
            // Macros View (Stacked Bars)
            data.map((d) => {
              const dayX = x0Scale(d.dayName) ?? 0;
              const barWidth = Math.max(10, Math.min(48, Math.floor(bandWidth * 0.72)));
              const groupOffset = (bandWidth - barWidth) / 2;
              const barX = dayX + groupOffset;
              const radius = Math.min(5, barWidth / 2);

              const protein = d.protein || 0;
              const carbs = d.carbs || 0;
              const fat = d.fat || 0;

              // Stack 1: Protein (bottom)
              const yProt = yScale(protein);
              const hProt = Math.max(0, innerHeight - yProt);

              // Stack 2: Carbs (middle)
              const yCarbs = yScale(protein + carbs);
              const hCarbs = Math.max(0, yProt - yCarbs);

              // Stack 3: Fat (top)
              const yFat = yScale(protein + carbs + fat);
              const hFat = Math.max(0, yCarbs - yFat);

              return (
                <g key={`macro-bars-${d.dayName}`}>
                  {hProt > 0 && (
                    <Bar
                      x={barX}
                      y={yProt}
                      width={barWidth}
                      height={hProt}
                      fill="#10b981"
                    />
                  )}
                  {hCarbs > 0 && (
                    <Bar
                      x={barX}
                      y={yCarbs}
                      width={barWidth}
                      height={hCarbs}
                      fill="#eab308"
                    />
                  )}
                  {hFat > 0 && (
                    <BarRounded
                      x={barX}
                      y={yFat}
                      width={barWidth}
                      height={hFat}
                      top
                      radius={radius}
                      fill="#f97316"
                    />
                  )}
                </g>
              );
            })
          )}

          <AxisBottom
            top={innerHeight}
            scale={x0Scale}
            stroke="#27272a"
            tickStroke="transparent"
            tickLabelProps={() => ({
              fill: "#a1a1aa",
              fontSize: 11,
              textAnchor: "middle",
              dy: 4,
            })}
          />

          <AxisLeft
            scale={yScale}
            numTicks={4}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(val) => Number(val).toLocaleString()}
            tickLabelProps={() => ({
              fill: "#71717a",
              fontSize: 10,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            })}
          />

          {/* Capture Mouse / Touch Events */}
          <Bar
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={hideTooltip}
            onTouchStart={handlePointer}
            onTouchMove={handlePointer}
            className="cursor-pointer"
          />
        </Group>
      </svg>

      {/* Rich Glassmorphic Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
            pointerEvents: "none",
          }}
        >
          {(() => {
            const net = tooltipData.caloriesIn - tooltipData.caloriesOut;
            const isDeficit = net < 0;

            return (
              <div className="p-3.5 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-44 select-none">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
                  <span className="font-bold text-white">{tooltipData.dayName}</span>
                  <span className="text-zinc-500 text-[10px]">{tooltipData.dateString}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>Calories In:</span>
                    </span>
                    <span className="font-bold text-white tabular-nums">
                      {tooltipData.caloriesIn.toLocaleString()} kcal
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-orange-400" />
                      <span>Calories Out:</span>
                    </span>
                    <span className="font-bold text-white tabular-nums">
                      {tooltipData.caloriesOut.toLocaleString()} kcal
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-zinc-800/60 font-semibold">
                    <span className="text-zinc-400">Net Energy:</span>
                    <span className={`tabular-nums ${isDeficit ? "text-emerald-400" : "text-amber-400"}`}>
                      {isDeficit ? "" : "+"}
                      {net.toLocaleString()} kcal ({isDeficit ? "Deficit" : "Surplus"})
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-1 tabular-nums">
                    <span>P: {Number(tooltipData.protein || 0).toFixed(1)}g</span>
                    <span>C: {Number(tooltipData.carbs || 0).toFixed(1)}g</span>
                    <span>F: {Number(tooltipData.fat || 0).toFixed(1)}g</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </TooltipWithBounds>
      )}
    </div>
  );
}

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

      {/* Visx Chart Canvas with compact Legend */}
      <figure
        aria-label="7-Day energy intake and expenditure chart"
        className="h-64 sm:h-72 w-full flex flex-col justify-between"
      >
        {/* Chart Legend */}
        <div className="flex items-center justify-end gap-3.5 text-[11px] text-zinc-400 select-none pb-1 shrink-0">
          {viewMode === "energy" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Calories In</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                <span>Calories Out</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-0 border-b border-dashed border-zinc-400 shrink-0" />
                <span>Calorie Target</span>
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Protein (g)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                <span>Carbs (g)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                <span>Fat (g)</span>
              </span>
            </>
          )}
        </div>

        <div className="flex-1 w-full min-h-0">
          <ParentSize debounceTime={10}>
            {({ width, height }) => (
              <EnergyBalanceChartInner
                width={width}
                height={height}
                data={data}
                viewMode={viewMode}
              />
            )}
          </ParentSize>
        </div>
      </figure>
    </section>
  );
}

export default EnergyBalanceChart;
