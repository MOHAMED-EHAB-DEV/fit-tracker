"use client";

import { useId, useMemo, useCallback } from "react";
import Link from "next/link";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { AreaClosed, LinePath, Bar, Line } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { LinearGradient } from "@visx/gradient";
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip";
import { localPoint } from "@visx/event";
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

interface WeightChartProps {
  width: number;
  height: number;
  history: IWeightDataPoint[];
  minWeight: number;
  maxWeight: number;
}

function WeightTrendChartInner({
  width,
  height,
  history,
  minWeight,
  maxWeight,
}: WeightChartProps) {
  const margin = useMemo(
    () => ({ top: 8, right: 6, bottom: 18, left: 28 }),
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
  } = useTooltip<IWeightDataPoint>();

  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(1, history.length - 1)],
        range: [0, innerWidth],
      }),
    [history.length, innerWidth]
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [minWeight, maxWeight],
        range: [innerHeight, 0],
        nice: false,
      }),
    [minWeight, maxWeight, innerHeight]
  );

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
      const index = Math.max(0, Math.min(history.length - 1, Math.round(rawIdx)));
      const d = history[index];
      if (!d) return;

      showTooltip({
        tooltipData: d,
        tooltipLeft: margin.left + xScale(index),
        tooltipTop: margin.top + yScale(d.weight),
      });
    },
    [history, innerWidth, margin.left, margin.top, showTooltip, hideTooltip, xScale, yScale]
  );

  if (width < 40 || height < 40) return null;

  // Calculate clean tick indices (max 4 on small screen, max 6 on large)
  const maxTicks = innerWidth < 300 ? 3 : 5;
  const tickStep = Math.max(1, Math.floor((history.length - 1) / (maxTicks - 1)));
  const tickValues: number[] = [];
  for (let i = 0; i < history.length; i += tickStep) {
    tickValues.push(i);
  }
  if (tickValues[tickValues.length - 1] !== history.length - 1) {
    tickValues.push(history.length - 1);
  }

  const activeIndex = tooltipData
    ? history.findIndex((h) => h.date === tooltipData.date && h.weight === tooltipData.weight)
    : -1;

  // Evenly spaced Y ticks
  const midWeight = Math.round((minWeight + maxWeight) / 2);
  const yTicks = [Math.round(minWeight), midWeight, Math.round(maxWeight)];

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <LinearGradient
            id="weight-area-gradient"
            from="#10b981"
            to="#10b981"
            fromOpacity={0.35}
            toOpacity={0.0}
          />
          <filter id="weight-line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3" />
          </filter>
        </defs>

        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke="#27272a"
            strokeDasharray="3 3"
            numTicks={3}
          />

          <AreaClosed<IWeightDataPoint>
            data={history}
            x={(_, i) => xScale(i ?? 0)}
            y={(d) => yScale(d.weight)}
            yScale={yScale}
            curve={curveMonotoneX}
            fill="url(#weight-area-gradient)"
          />

          <LinePath<IWeightDataPoint>
            data={history}
            x={(_, i) => xScale(i ?? 0)}
            y={(d) => yScale(d.weight)}
            curve={curveMonotoneX}
            stroke="#10b981"
            strokeWidth={2.5}
            strokeLinecap="round"
            filter="url(#weight-line-glow)"
          />

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickValues={tickValues}
            stroke="#27272a"
            tickStroke="transparent"
            tickFormat={(val) => {
              const idx = Math.round(Number(val));
              return history[idx]?.date || "";
            }}
            tickLabelProps={() => ({
              fill: "#71717a",
              fontSize: 10,
              textAnchor: "middle",
              dy: 4,
            })}
          />

          <AxisLeft
            scale={yScale}
            tickValues={yTicks}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(val) => `${Math.round(Number(val))}`}
            tickLabelProps={() => ({
              fill: "#71717a",
              fontSize: 10,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            })}
          />

          {/* Interactive Hover Vertical Crosshair & Glow Dot */}
          {tooltipOpen && activeIndex >= 0 && (
            <g pointerEvents="none">
              <Line
                from={{ x: xScale(activeIndex), y: 0 }}
                to={{ x: xScale(activeIndex), y: innerHeight }}
                stroke="#3f3f46"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle
                cx={xScale(activeIndex)}
                cy={yScale(history[activeIndex].weight)}
                r={7}
                fill="#10b981"
                fillOpacity={0.25}
              />
              <circle
                cx={xScale(activeIndex)}
                cy={yScale(history[activeIndex].weight)}
                r={3.5}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          )}

          {/* Invisible Overlay for Mouse/Touch Capture */}
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
            className="cursor-crosshair"
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
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            color: "white",
            padding: "0.625rem 0.75rem",
            backdropFilter: "blur(12px)",
            pointerEvents: "none",
          }}
        >
          <div className="text-zinc-400 text-[10px]">{tooltipData.date}</div>
          <div className="font-extrabold text-white text-sm tabular-nums">
            {tooltipData.weight} kg
          </div>
          {tooltipData.bodyFatPercent != null && (
            <div className="text-amber-400 text-[10px] font-semibold tabular-nums">
              {tooltipData.bodyFatPercent}% Body Fat
            </div>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}

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

  // Proportional padding for chart Y-Axis so line and area fill the vertical height effectively
  const weights = history.map((h) => h.weight);
  const rawMin = weights.length > 0 ? Math.min(...weights) : 60;
  const rawMax = weights.length > 0 ? Math.max(...weights) : 90;
  const span = Math.max(1, rawMax - rawMin);
  const pad = Math.max(0.6, +(span * 0.12).toFixed(1));
  const minWeight = +(rawMin - pad).toFixed(1);
  const maxWeight = +(rawMax + pad).toFixed(1);

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

      {/* Visx Sparkline Chart */}
      {history.length < 2 ? (
        <div className="py-8 text-center border border-dashed border-zinc-800 rounded-2xl space-y-1">
          <Scale aria-hidden="true" className="w-6 h-6 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400 font-medium">Log 2 or more weigh-ins to generate your trend chart</p>
        </div>
      ) : (
        <figure aria-label="Body weight trend over time chart" className="h-44 w-full pt-1">
          <ParentSize debounceTime={10}>
            {({ width, height }) => (
              <WeightTrendChartInner
                width={width}
                height={height}
                history={history}
                minWeight={minWeight}
                maxWeight={maxWeight}
              />
            )}
          </ParentSize>
        </figure>
      )}
    </section>
  );
}

export default WeightTrendWidget;
