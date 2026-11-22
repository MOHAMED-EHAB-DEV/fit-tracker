"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { ParentSize } from "@visx/responsive";
import { Group } from "@visx/group";
import { Bar, Line } from "@visx/shape";
import { scaleBand, scaleLinear } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { TooltipWithBounds, defaultStyles, useTooltip } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CHART_COLORS, CHART_FONT, CHART_STROKE } from "@/lib/ui/chart-theme";
import { balanceTone, goalLabel, summarizeEnergy, type EnergyDay, type Goal } from "@/lib/dashboard/energy";
import { cn } from "@/lib/utils";

export interface EnergyBalanceChartProps {
  /** buildEnergySeries(...) from "@/lib/dashboard/energy": one entry per day of the week. */
  data: EnergyDay[];
  goal: Goal | null;
  /** The user's calorie target (null when none). */
  targetCalories: number | null;
  /** The user's TDEE, for the goal label. */
  tdee: number | null;
  className?: string;
}

type ViewMode = "energy" | "macros";

const TAP_SLOP_PX = 10;
const MARGIN = { top: 12, right: 4, bottom: 24, left: 52 };

function ChartInner({ width, height, data, viewMode }: { width: number; height: number; data: EnergyDay[]; viewMode: ViewMode }) {
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const { tooltipData, tooltipLeft = 0, tooltipTop = 0, tooltipOpen, showTooltip, hideTooltip } = useTooltip<EnergyDay>();

  const xScale = useMemo(
    () => scaleBand<string>({ domain: data.map((d) => d.dateString), range: [0, innerWidth], padding: 0.2 }),
    [data, innerWidth]
  );
  const bandWidth = xScale.bandwidth();

  const yScale = useMemo(() => {
    const maxVal =
      viewMode === "energy"
        ? Math.max(0, ...data.map((d) => Math.max(d.caloriesIn ?? 0, d.caloriesOut ?? 0, d.targetCalories ?? 0)))
        : Math.max(0, ...data.map((d) => (d.protein ?? 0) + (d.carbs ?? 0) + (d.fat ?? 0)));
    const floor = viewMode === "energy" ? 500 : 50;
    return scaleLinear<number>({ domain: [0, Math.max(floor, Math.ceil(maxVal * 1.06))], range: [innerHeight, 0], nice: true });
  }, [data, innerHeight, viewMode]);

  const indexAt = useCallback(
    (x: number) => {
      const local = x - MARGIN.left;
      if (local < 0 || local > innerWidth || data.length === 0) return null;
      return Math.max(0, Math.min(data.length - 1, Math.floor(local / (innerWidth / data.length))));
    },
    [data.length, innerWidth]
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
        tooltipLeft: MARGIN.left + (xScale(d.dateString) ?? 0) + bandWidth / 2,
        tooltipTop: MARGIN.top + Math.max(0, yScale(top)),
      });
    },
    [bandWidth, data, hideTooltip, showTooltip, viewMode, xScale, yScale]
  );

  if (width < 40 || height < 40) return null;

  return (
    <div className="relative h-full w-full select-none">
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke={CHART_COLORS.line}
            strokeWidth={CHART_STROKE.grid}
            strokeDasharray={CHART_STROKE.gridDash}
            numTicks={4}
          />

          {data.map((d) => {
            const highlighted = tooltipOpen && tooltipData?.dateString === d.dateString;
            return highlighted ? (
              <rect
                key={`spot-${d.dateString}`}
                x={(xScale(d.dateString) ?? 0) - 3}
                y={0}
                width={bandWidth + 6}
                height={innerHeight}
                rx={4}
                fill={CHART_COLORS.elevated}
                pointerEvents="none"
              />
            ) : null;
          })}

          {viewMode === "energy"
            ? data.map((d) => {
                const dayX = xScale(d.dateString) ?? 0;
                const gap = Math.max(2, Math.min(4, Math.round(bandWidth * 0.06)));
                const barWidth = Math.max(5, Math.min(28, Math.floor((bandWidth - gap) / 2)));
                const offset = (bandWidth - (barWidth * 2 + gap)) / 2;
                const inX = dayX + offset;
                const outX = inX + barWidth + gap;
                return (
                  <g key={`energy-${d.dateString}`}>
                    {d.caloriesIn !== null && d.caloriesIn > 0 && (
                      <Bar
                        x={inX}
                        y={yScale(d.caloriesIn)}
                        width={barWidth}
                        height={innerHeight - yScale(d.caloriesIn)}
                        fill={d.isToday ? CHART_COLORS.accent : CHART_COLORS.ink}
                      />
                    )}
                    {d.caloriesOut !== null && d.caloriesOut > 0 && (
                      <Bar
                        x={outX}
                        y={yScale(d.caloriesOut)}
                        width={barWidth}
                        height={innerHeight - yScale(d.caloriesOut)}
                        fill={CHART_COLORS.lineStrong}
                      />
                    )}
                    {d.targetCalories !== null && (
                      <Line
                        from={{ x: dayX - 2, y: yScale(d.targetCalories) }}
                        to={{ x: dayX + bandWidth + 2, y: yScale(d.targetCalories) }}
                        stroke={CHART_COLORS.ink2}
                        strokeDasharray={CHART_STROKE.targetDash}
                        strokeWidth={CHART_STROKE.line}
                      />
                    )}
                  </g>
                );
              })
            : data.map((d) => {
                if (d.protein === null || d.carbs === null || d.fat === null) return null;
                const barWidth = Math.max(8, Math.min(40, Math.floor(bandWidth * 0.62)));
                const barX = (xScale(d.dateString) ?? 0) + (bandWidth - barWidth) / 2;
                const yP = yScale(d.protein);
                const yC = yScale(d.protein + d.carbs);
                const yF = yScale(d.protein + d.carbs + d.fat);
                return (
                  <g key={`macros-${d.dateString}`}>
                    {innerHeight - yP > 0 && <Bar x={barX} y={yP} width={barWidth} height={innerHeight - yP} fill={CHART_COLORS.ink} />}
                    {yP - yC > 0 && <Bar x={barX} y={yC} width={barWidth} height={yP - yC} fill={CHART_COLORS.ink3} />}
                    {yC - yF > 0 && <Bar x={barX} y={yF} width={barWidth} height={yC - yF} fill={CHART_COLORS.lineStrong} />}
                  </g>
                );
              })}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            stroke={CHART_COLORS.line}
            tickStroke="transparent"
            tickFormat={(value) => data.find((d) => d.dateString === value)?.dayLabel ?? ""}
            tickLabelProps={(value) => {
              const day = data.find((d) => d.dateString === value);
              return {
                fill: day?.isToday ? CHART_COLORS.accent : CHART_COLORS.ink3,
                fontFamily: CHART_FONT.family,
                fontSize: CHART_FONT.size,
                fontWeight: day?.isToday ? 600 : 400,
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
            tickLabelProps={() => ({
              fill: CHART_COLORS.ink3,
              fontFamily: CHART_FONT.family,
              fontSize: CHART_FONT.size,
              textAnchor: "end",
              dx: -4,
              dy: 3,
            })}
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
          <div className="glass-float min-w-44 space-y-1.5 rounded-control px-3 py-2.5 text-xs text-ink-2">
            <p className="border-b border-line pb-1.5 font-semibold text-ink">
              {tooltipData.fullDateLabel}
              {tooltipData.isToday && <span className="ms-1 font-normal text-accent">so far</span>}
            </p>
            {tooltipData.caloriesIn === null ? (
              <p className="text-ink-3">No food logged.</p>
            ) : (
              <>
                <p className="flex justify-between gap-3">
                  <span>Calories in</span>
                  <span className="font-mono tabular-nums text-ink">{tooltipData.caloriesIn.toLocaleString()} kcal</span>
                </p>
                {tooltipData.caloriesOut !== null && (
                  <p className="flex justify-between gap-3">
                    <span>Calories out</span>
                    <span className="font-mono tabular-nums text-ink">{tooltipData.caloriesOut.toLocaleString()} kcal</span>
                  </p>
                )}
                {tooltipData.net !== null && (
                  <p className="flex justify-between gap-3 border-t border-line pt-1">
                    <span>Net</span>
                    <span className="font-mono tabular-nums text-ink">
                      {tooltipData.net > 0 ? "+" : ""}
                      {tooltipData.net.toLocaleString()} kcal
                    </span>
                  </p>
                )}
                <p className="flex justify-between pt-0.5 font-mono tabular-nums text-ink-3">
                  <span>P {tooltipData.protein ?? 0}g</span>
                  <span>C {tooltipData.carbs ?? 0}g</span>
                  <span>F {tooltipData.fat ?? 0}g</span>
                </p>
              </>
            )}
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

function LegendSwatch({ className, dashed = false }: { className?: string; dashed?: boolean }) {
  return dashed ? (
    <span aria-hidden="true" className="w-3.5 border-b-[1.5px] border-dashed border-ink-2" />
  ) : (
    <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[2px]", className)} />
  );
}

/**
 * Eat › Week: calories eaten against calories burned for each day (today's
 * bar in accent), the target as a dashed line, or protein / carbs / fat
 * stacked; with the week's averages above.
 */
export function EnergyBalanceChart({ data, goal, targetCalories, tdee, className }: EnergyBalanceChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("energy");
  const headingId = useId();
  const summary = useMemo(() => summarizeEnergy(data), [data]);
  const tone = balanceTone(summary.avgNet, goal);
  const basis =
    summary.daysCounted === 0
      ? "Log meals to see your balance."
      : `From ${summary.daysCounted} logged day${summary.daysCounted === 1 ? "" : "s"}${summary.includesToday ? ", today so far" : ""}. Burned = your TDEE, or more on active days.`;

  const cells: Array<{ label: string; value: string; unit?: string; tone?: string }> = [
    { label: "Avg in", value: summary.avgIn !== null ? summary.avgIn.toLocaleString() : "—", unit: "kcal" },
    { label: "Avg burned", value: summary.avgOut !== null ? summary.avgOut.toLocaleString() : "—", unit: "kcal" },
    {
      label: "Net",
      value: summary.net !== null ? `${summary.net > 0 ? "+" : ""}${summary.net.toLocaleString()}` : "—",
      unit: "kcal",
      tone: tone === "good" ? "text-ok" : tone === "off" ? "text-warn" : "text-ink",
    },
  ];

  return (
    <section aria-labelledby={headingId} className={cn("overflow-hidden rounded-card border border-line bg-surface", className)}>
      <header className="flex items-center justify-between gap-3 px-3.5 pt-3">
        <h2 id={headingId} className="text-[13px] font-semibold text-ink-2">
          Energy balance
        </h2>
        <SegmentedControl<ViewMode>
          label="Chart view"
          value={viewMode}
          options={[
            { value: "energy", label: "kcal" },
            { value: "macros", label: "Macros" },
          ]}
          onChange={setViewMode}
        />
      </header>

      <dl className="mt-2.5 grid grid-cols-3 divide-x divide-line border-y border-line">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-0 px-3.5 py-2.5">
            <dt className="text-xs text-ink-3">{cell.label}</dt>
            <dd className={cn("truncate font-mono text-[15px] font-semibold tabular-nums", cell.tone ?? "text-ink")}>
              {cell.value}
              {cell.unit && <span className="text-xs font-normal text-ink-3"> {cell.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2 px-3.5 pb-3.5 pt-3">
        <p className="text-xs leading-5 text-ink-3">
          <span className="font-medium text-ink-2">{goalLabel(goal, targetCalories, tdee)}.</span> {basis}
        </p>
        <figure aria-label="Calories eaten and burned each day of the week" className="flex h-56 w-full flex-col sm:h-64">
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3.5 gap-y-1 pb-1 text-xs text-ink-3">
            {viewMode === "energy" ? (
              <>
                <span className="flex items-center gap-1.5">
                  <LegendSwatch className="bg-ink" />
                  In
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendSwatch className="bg-line-strong" />
                  Burned
                </span>
                {targetCalories !== null && (
                  <span className="flex items-center gap-1.5">
                    <LegendSwatch dashed />
                    Target
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <LegendSwatch className="bg-ink" />
                  Protein
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendSwatch className="bg-ink-3" />
                  Carbs
                </span>
                <span className="flex items-center gap-1.5">
                  <LegendSwatch className="bg-line-strong" />
                  Fat
                </span>
              </>
            )}
          </div>
          <div className="min-h-0 w-full flex-1">
            <ParentSize debounceTime={10}>
              {({ width, height }) => <ChartInner width={width} height={height} data={data} viewMode={viewMode} />}
            </ParentSize>
          </div>
        </figure>
      </div>
    </section>
  );
}

export default EnergyBalanceChart;
