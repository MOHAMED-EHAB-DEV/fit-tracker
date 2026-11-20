"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { Bar, BarRounded, Line } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { TooltipWithBounds, defaultStyles, useTooltip } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { Flame, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { balanceTone, goalLabel, summarizeEnergy, type EnergyDay, type Goal } from "@/lib/dashboard/energy";

export interface EnergyBalanceChartProps {
  /** buildEnergySeries(...) from "@/lib/dashboard/energy": one entry per week day. */
  data: EnergyDay[];
  goal: Goal | null;
  /** The user's calorie target (null when none). */
  targetCalories: number | null;
  /** The user's TDEE (computed.tdee), used for the goal offset label. */
  tdee: number | null;
}

/** @deprecated Use EnergyDay from "@/lib/dashboard/energy". */
export type IDailyHistoryPoint = EnergyDay;

type ViewMode = "energy" | "macros";

const TAP_SLOP_PX = 10;

function EnergyBalanceChartInner({
  width,
  height,
  data,
  viewMode,
}: {
  width: number;
  height: number;
  data: EnergyDay[];
  viewMode: ViewMode;
}) {
  const margin = useMemo(() => ({ top: 12, right: 8, bottom: 22, left: 44 }), []);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);

  const { tooltipData, tooltipLeft = 0, tooltipTop = 0, tooltipOpen, showTooltip, hideTooltip } = useTooltip<EnergyDay>();

  const xScale = useMemo(
    () => scaleBand<string>({ domain: data.map((d) => d.dateString), range: [0, innerWidth], padding: 0.16 }),
    [data, innerWidth]
  );
  const bandWidth = xScale.bandwidth();

  const yScale = useMemo(() => {
    const maxVal =
      viewMode === "energy"
        ? Math.max(0, ...data.map((d) => Math.max(d.caloriesIn ?? 0, d.caloriesOut ?? 0, d.targetCalories ?? 0)))
        : Math.max(0, ...data.map((d) => (d.protein ?? 0) + (d.carbs ?? 0) + (d.fat ?? 0)));
    const floor = viewMode === "energy" ? 500 : 50;
    return scaleLinear<number>({ domain: [0, Math.max(floor, Math.ceil(maxVal * 1.06))], range: [innerHeight, 0] });
  }, [data, innerHeight, viewMode]);

  const indexAt = useCallback(
    (x: number) => {
      const local = x - margin.left;
      if (local < 0 || local > innerWidth || data.length === 0) return null;
      return Math.max(0, Math.min(data.length - 1, Math.floor(local / (innerWidth / data.length))));
    },
    [data.length, innerWidth, margin.left]
  );

  const showAt = useCallback(
    (index: number | null) => {
      const d = index === null ? null : data[index];
      if (!d || d.isFuture) {
        hideTooltip();
        return;
      }
      const top =
        viewMode === "energy"
          ? Math.max(d.caloriesIn ?? 0, d.caloriesOut ?? 0, d.targetCalories ?? 0)
          : (d.protein ?? 0) + (d.carbs ?? 0) + (d.fat ?? 0);
      showTooltip({
        tooltipData: d,
        tooltipLeft: margin.left + (xScale(d.dateString) ?? 0) + bandWidth / 2,
        tooltipTop: margin.top + Math.max(0, yScale(top)),
      });
    },
    [bandWidth, data, hideTooltip, margin.left, margin.top, showTooltip, viewMode, xScale, yScale]
  );

  if (width < 40 || height < 40) return null;

  return (
    <div className="relative w-full h-full select-none">
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={innerWidth} stroke="#27272a" strokeDasharray="3 3" numTicks={4} />

          {data.map((d) => (
            <rect
              key={`spot-${d.dateString}`}
              x={(xScale(d.dateString) ?? 0) - 3}
              y={0}
              width={bandWidth + 6}
              height={innerHeight}
              rx={6}
              fill={tooltipOpen && tooltipData?.dateString === d.dateString ? "rgba(255,255,255,0.04)" : d.isToday ? "rgba(16,185,129,0.04)" : "transparent"}
              pointerEvents="none"
            />
          ))}

          {viewMode === "energy"
            ? data.map((d) => {
                const dayX = xScale(d.dateString) ?? 0;
                const gap = Math.max(2, Math.min(4, Math.round(bandWidth * 0.05)));
                const barWidth = Math.max(6, Math.min(36, Math.floor((bandWidth - gap) / 2)));
                const offset = (bandWidth - (barWidth * 2 + gap)) / 2;
                const radius = Math.min(5, barWidth / 2);
                const inX = dayX + offset;
                const outX = inX + barWidth + gap;
                return (
                  <g key={`energy-${d.dateString}`}>
                    {d.caloriesIn !== null && d.caloriesIn > 0 && (
                      <BarRounded x={inX} y={yScale(d.caloriesIn)} width={barWidth} height={innerHeight - yScale(d.caloriesIn)} top radius={radius} fill="#10b981" />
                    )}
                    {d.caloriesOut !== null && d.caloriesOut > 0 && (
                      <BarRounded
                        x={outX}
                        y={yScale(d.caloriesOut)}
                        width={barWidth}
                        height={innerHeight - yScale(d.caloriesOut)}
                        top
                        radius={radius}
                        fill="#f97316"
                        opacity={d.isToday ? 0.6 : 1}
                      />
                    )}
                    {d.targetCalories !== null && (
                      <Line
                        from={{ x: dayX, y: yScale(d.targetCalories) }}
                        to={{ x: dayX + bandWidth, y: yScale(d.targetCalories) }}
                        stroke="#a1a1aa"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    )}
                  </g>
                );
              })
            : data.map((d) => {
                if (d.protein === null || d.carbs === null || d.fat === null) return null;
                const barWidth = Math.max(10, Math.min(48, Math.floor(bandWidth * 0.72)));
                const barX = (xScale(d.dateString) ?? 0) + (bandWidth - barWidth) / 2;
                const yP = yScale(d.protein);
                const yC = yScale(d.protein + d.carbs);
                const yF = yScale(d.protein + d.carbs + d.fat);
                return (
                  <g key={`macros-${d.dateString}`}>
                    {innerHeight - yP > 0 && <Bar x={barX} y={yP} width={barWidth} height={innerHeight - yP} fill="#10b981" />}
                    {yP - yC > 0 && <Bar x={barX} y={yC} width={barWidth} height={yP - yC} fill="#eab308" />}
                    {yC - yF > 0 && <BarRounded x={barX} y={yF} width={barWidth} height={yC - yF} top radius={Math.min(5, barWidth / 2)} fill="#f97316" />}
                  </g>
                );
              })}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            stroke="#27272a"
            tickStroke="transparent"
            tickFormat={(value) => data.find((d) => d.dateString === value)?.dayLabel ?? ""}
            tickLabelProps={(value) => {
              const day = data.find((d) => d.dateString === value);
              return {
                fill: day?.isToday ? "#34d399" : day?.isFuture ? "#52525b" : "#a1a1aa",
                fontSize: 12,
                fontWeight: day?.isToday ? 700 : 500,
                textAnchor: "middle",
                dy: 4,
              };
            }}
          />
          <AxisLeft
            scale={yScale}
            numTicks={4}
            stroke="transparent"
            tickStroke="transparent"
            tickFormat={(val) => Number(val).toLocaleString()}
            tickLabelProps={() => ({ fill: "#a1a1aa", fontSize: 11, textAnchor: "end", dx: -4, dy: 3 })}
          />

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
              showAt(p ? indexAt(p.x) : null);
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
              showAt(p ? indexAt(p.x) : null);
            }}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{ ...defaultStyles, backgroundColor: "transparent", border: "none", boxShadow: "none", padding: 0, pointerEvents: "none" }}
        >
          <div className="p-3 rounded-2xl bg-zinc-900/95 border border-zinc-800 shadow-2xl text-xs space-y-1.5 min-w-44">
            <div className="font-bold text-white border-b border-zinc-800/80 pb-1.5">
              {tooltipData.fullDateLabel}
              {tooltipData.isToday && <span className="ms-1 text-emerald-400">(today, so far)</span>}
            </div>
            {tooltipData.caloriesIn === null ? (
              <p className="text-zinc-400">No food logged.</p>
            ) : (
              <>
                <div className="flex justify-between gap-3 text-zinc-300">
                  <span>Calories in</span>
                  <span className="font-bold text-white tabular-nums">{tooltipData.caloriesIn.toLocaleString()} kcal</span>
                </div>
                {tooltipData.caloriesOut !== null && (
                  <div className="flex justify-between gap-3 text-zinc-300">
                    <span>Calories out</span>
                    <span className="font-bold text-white tabular-nums">{tooltipData.caloriesOut.toLocaleString()} kcal</span>
                  </div>
                )}
                {tooltipData.net !== null && (
                  <div className="flex justify-between gap-3 pt-1 border-t border-zinc-800/60 font-semibold text-zinc-300">
                    <span>Net</span>
                    <span className="tabular-nums">
                      {tooltipData.net > 0 ? "+" : ""}
                      {tooltipData.net.toLocaleString()} kcal
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-400 pt-1 tabular-nums">
                  <span>P {tooltipData.protein ?? 0}g</span>
                  <span>C {tooltipData.carbs ?? 0}g</span>
                  <span>F {tooltipData.fat ?? 0}g</span>
                </div>
              </>
            )}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

const TONE_CLASS = { good: "text-emerald-400", off: "text-amber-400", neutral: "text-zinc-200" } as const;

export function EnergyBalanceChart({ data, goal, targetCalories, tdee }: EnergyBalanceChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("energy");
  const headingId = useId();
  const summary = useMemo(() => summarizeEnergy(data), [data]);
  const tone = balanceTone(summary.avgNet, goal);
  const NetIcon = summary.net === null || summary.net === 0 ? Minus : summary.net < 0 ? TrendingDown : TrendingUp;
  const basis =
    summary.daysCounted === 0
      ? "Log meals to see your balance."
      : `Based on ${summary.daysCounted} logged day${summary.daysCounted === 1 ? "" : "s"}${summary.includesToday ? " (including today so far)" : ""}.`;

  return (
    <section aria-labelledby={headingId} className="p-4 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800/80 space-y-5 flex flex-col">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div aria-hidden="true" className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Flame className="w-4 h-4" />
            </div>
            <h3 id={headingId} className="font-bold text-base text-white">
              This week&apos;s energy balance
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">Calories eaten vs. burned (your TDEE, or more on active days)</p>
        </div>
        <div role="group" aria-label="Chart view" className="flex items-center p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-sm font-semibold self-start sm:self-auto">
          {(["energy", "macros"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`min-h-11 px-3 rounded-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                viewMode === mode ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {mode === "energy" ? "Energy (kcal)" : "Macros (g)"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
        <article className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <h4 className="text-xs uppercase font-bold text-zinc-400 truncate">Avg daily in</h4>
          <p className="text-base sm:text-lg font-extrabold text-white mt-1 tabular-nums">
            {summary.avgIn !== null ? summary.avgIn.toLocaleString() : "—"} <span className="text-xs font-medium text-zinc-400">kcal</span>
          </p>
        </article>
        <article className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <h4 className="text-xs uppercase font-bold text-zinc-400 truncate">Avg daily burn</h4>
          <p className="text-base sm:text-lg font-extrabold text-orange-400 mt-1 tabular-nums">
            {summary.avgOut !== null ? summary.avgOut.toLocaleString() : "—"} <span className="text-xs font-medium text-zinc-400">kcal</span>
          </p>
        </article>
        <article className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <h4 className="text-xs uppercase font-bold text-zinc-400 truncate">Net balance</h4>
          <p className={`flex items-center gap-1 text-base sm:text-lg font-extrabold mt-1 tabular-nums ${TONE_CLASS[tone]}`}>
            <NetIcon aria-hidden="true" className="w-4 h-4 shrink-0" />
            {summary.net !== null ? `${summary.net > 0 ? "+" : ""}${summary.net.toLocaleString()}` : "—"}
            <span className="text-xs font-medium text-zinc-400">kcal</span>
          </p>
        </article>
        <article className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
          <h4 className="text-xs uppercase font-bold text-zinc-400 truncate">Goal</h4>
          <p className="text-sm font-bold text-emerald-300 mt-1">{goalLabel(goal, targetCalories, tdee)}</p>
        </article>
      </div>
      <p className="text-xs text-zinc-400 -mt-2">{basis}</p>

      <figure aria-label="Daily calories eaten and burned this week" className="h-64 sm:h-72 w-full flex flex-col">
        <div className="flex items-center justify-end flex-wrap gap-x-3.5 gap-y-1 text-xs text-zinc-400 pb-1 shrink-0">
          {viewMode === "energy" ? (
            <>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Calories in</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-orange-500" />Calories out</span>
              {targetCalories !== null && (
                <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-3.5 border-b border-dashed border-zinc-400" />Target</span>
              )}
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Protein</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-yellow-500" />Carbs</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-orange-500" />Fat</span>
            </>
          )}
        </div>
        <div className="flex-1 w-full min-h-0">
          <ParentSize debounceTime={10}>
            {({ width, height }) => <EnergyBalanceChartInner width={width} height={height} data={data} viewMode={viewMode} />}
          </ParentSize>
        </div>
      </figure>
    </section>
  );
}

export default EnergyBalanceChart;
