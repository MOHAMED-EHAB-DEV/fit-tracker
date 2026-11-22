"use client";

import React, { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { CHART_COLORS, CHART_STROKE } from "@/lib/ui/chart-theme";
import { fromKg, type WeightUnit } from "@/lib/fitness/units";
import { movingAverage, pointsWithinDays, weightChange, weightChangeTone, type WeightPoint } from "@/lib/dashboard/weight";
import { formatDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

type Range = "30" | "90";

interface WeightHeroProps {
  /** Every recent weigh-in (any order). */
  points: WeightPoint[];
  weightUnit: WeightUnit;
  goal: "cut" | "maintain" | "bulk" | null;
  /** "Now" from the server, so the first render matches. */
  nowMs: number;
}

const W = 328;
const H = 136;
const LEFT = 30;
const RIGHT = 324;
const TOP = 16;
const BOTTOM = 104;

/**
 * Body's hero: the latest weight, the change over the chosen range, and a
 * chart with every weigh-in as a dot and the 7-day average as a line.
 */
export function WeightHero({ points, weightUnit, goal, nowMs }: WeightHeroProps) {
  const [range, setRange] = useState<Range>("30");
  const days = Number(range);
  const latest = useMemo(() => [...points].sort((a, b) => b.timestamp - a.timestamp)[0] ?? null, [points]);
  // A weigh-in logged after the page was rendered is newer than the server's
  // "now"; move the right edge to it so it shows at once, without a reload.
  const chartNowMs = Math.max(nowMs, latest?.timestamp ?? 0);
  const shown = useMemo(() => pointsWithinDays(points, days, chartNowMs), [points, days, chartNowMs]);
  const averages = useMemo(() => movingAverage(shown), [shown]);
  const change = weightChange(shown);
  const tone = change ? weightChangeTone(change.deltaKg, goal) : "neutral";

  const display = (kg: number) => fromKg(kg, weightUnit, 1);
  const values = shown.map((point) => display(point.weightKg));
  const min = values.length > 0 ? Math.floor(Math.min(...values) - 0.5) : 0;
  const max = values.length > 0 ? Math.ceil(Math.max(...values) + 0.5) : 1;
  const span = Math.max(1, max - min);
  const from = chartNowMs - days * 86_400_000;
  const x = (timestamp: number) => LEFT + ((timestamp - from) / (chartNowMs - from)) * (RIGHT - LEFT - 6) + 3;
  const y = (value: number) => BOTTOM - ((value - min) / span) * (BOTTOM - TOP);
  const avgPath = shown
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.timestamp).toFixed(1)} ${y(display(averages[index])).toFixed(1)}`)
    .join(" ");
  const ticks = [max, Math.round(((max + min) / 2) * 10) / 10, min];
  const dateTicks = [0, 1 / 3, 2 / 3, 1].map((share) => from + share * (chartNowMs - from));

  const deltaText = change
    ? `${change.deltaKg > 0 ? "+" : change.deltaKg < 0 ? "−" : ""}${Math.abs(fromKg(change.deltaKg, weightUnit, 1)).toFixed(1)} ${weightUnit}`
    : null;

  return (
    <Surface as="section" aria-labelledby="weight-title">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="weight-title" className="sr-only">
            Weight
          </h2>
          <p>
            <span className="font-mono text-[32px] font-medium leading-none tracking-[-0.03em] tabular-nums text-ink">
              {latest ? display(latest.weightKg).toFixed(1) : "—"}
            </span>
            <span className="ms-1 text-sm text-ink-2">{weightUnit}</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
            {deltaText ? (
              <span
                className={cn("font-mono font-semibold tabular-nums", tone === "good" ? "text-ok" : tone === "off" ? "text-warn" : "text-ink")}
              >
                {deltaText}
              </span>
            ) : (
              <span className="text-ink-3">Not enough weigh-ins yet</span>
            )}
            {deltaText && <span className="text-ink-3">past {days} days</span>}
          </p>
        </div>
        <SegmentedControl<Range>
          label="Chart range"
          value={range}
          options={[
            { value: "30", label: "30d" },
            { value: "90", label: "90d" },
          ]}
          onChange={setRange}
        />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-control border border-dashed border-line-strong px-3 py-6 text-center text-[13px] text-ink-3">
          No weigh-ins in the last {days} days.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full"
            role="img"
            aria-label={`Weight over the last ${days} days: ${shown.length} weigh-in${shown.length === 1 ? "" : "s"}${deltaText ? `, ${deltaText}` : ""}.`}
          >
            {ticks.map((tick, index) => (
              <g key={index}>
                <line
                  x1={LEFT}
                  y1={y(tick)}
                  x2={RIGHT}
                  y2={y(tick)}
                  stroke={CHART_COLORS.line}
                  strokeWidth={CHART_STROKE.grid}
                  strokeDasharray={index === ticks.length - 1 ? undefined : CHART_STROKE.gridDash}
                />
                <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" fill={CHART_COLORS.ink3} fontSize={11} className="font-mono">
                  {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                </text>
              </g>
            ))}
            {shown.map((point) => (
              <circle key={`${point.timestamp}-${point.weightKg}`} cx={x(point.timestamp)} cy={y(display(point.weightKg))} r={2.6} fill={CHART_COLORS.ink2}>
                {/* One string: React renders a <title> with several children empty on the server. */}
                <title>{`${formatDateString(point.dateString)}: ${display(point.weightKg)} ${weightUnit}`}</title>
              </circle>
            ))}
            {shown.length > 1 && (
              <path d={avgPath} fill="none" stroke={CHART_COLORS.accent} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {shown.length > 0 && (
              <circle
                cx={x(shown[shown.length - 1].timestamp)}
                cy={y(display(averages[averages.length - 1]))}
                r={4.2}
                fill={CHART_COLORS.accent}
                stroke={CHART_COLORS.surface}
                strokeWidth={2}
              />
            )}
            {dateTicks.map((tick, index) => (
              <text
                key={index}
                x={index === 0 ? LEFT + 4 : index === dateTicks.length - 1 ? RIGHT : x(tick)}
                y={126}
                textAnchor={index === 0 ? "start" : index === dateTicks.length - 1 ? "end" : "middle"}
                fill={CHART_COLORS.ink3}
                fontSize={11}
                className="font-mono"
              >
                {formatDateString(new Date(tick).toISOString().slice(0, 10), { month: "short", day: "numeric" })}
              </text>
            ))}
          </svg>
          <div className="mt-2 flex items-center gap-3.5 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-2" />
              Daily
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-accent" />
              7-day average
            </span>
          </div>
        </>
      )}
    </Surface>
  );
}

export default WeightHero;
