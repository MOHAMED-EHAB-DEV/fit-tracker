import React from "react";
import { formatDateString } from "@/lib/time";
import { CHART_COLORS, CHART_STROKE } from "@/lib/ui/chart-theme";
import type { ProgressPoint } from "@/lib/workouts/progress";

export interface ExerciseProgressChartProps {
  label: string;
  points: ProgressPoint[];
  /** Formats a value for display ("102.5 kg", "12 reps", "1:30"). */
  format: (value: number) => string;
}

const PAD = 8;

/** A small trend line (one dot per workout) with the latest value and the change since the first. */
export function ExerciseProgressChart({ label, points, format }: ExerciseProgressChartProps) {
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (index: number) => PAD + (index / (points.length - 1)) * (100 - PAD * 2);
  const y = (value: number) => (max === min ? 50 : 100 - PAD - ((value - min) / span) * (100 - PAD * 2));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const change = last.value - first.value;
  const changeText = change === 0 ? "No change" : `${change > 0 ? "+" : "−"}${format(Math.abs(change))}`;
  const firstDate = formatDateString(first.date, { month: "short", day: "numeric" });
  const lastDate = formatDateString(last.date, { month: "short", day: "numeric" });

  return (
    <figure className="rounded-control border border-line bg-surface p-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-ink-3">{label}</span>
        <span className="text-end">
          <span className="font-mono text-[15px] font-semibold tabular-nums text-ink">{format(last.value)}</span>
          <span className="ms-2 font-mono text-xs tabular-nums text-ink-3">
            {changeText} since {firstDate}
          </span>
        </span>
      </figcaption>
      <div className="mt-2 flex h-28 gap-2">
        <div aria-hidden="true" className="relative w-[4.5rem] shrink-0 font-mono text-xs tabular-nums text-ink-3">
          <span style={{ top: `${PAD}%` }} className="absolute end-0 -translate-y-1/2 whitespace-nowrap">
            {format(max)}
          </span>
          <span style={{ top: `${100 - PAD}%` }} className="absolute end-0 -translate-y-1/2 whitespace-nowrap">
            {format(min)}
          </span>
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={`${label}: ${format(first.value)} on ${firstDate}, ${format(last.value)} on ${lastDate}, over ${points.length} workouts.`}
          >
            {[PAD, 50, 100 - PAD].map((lineY) => (
              <line
                key={lineY}
                x1={0}
                x2={100}
                y1={lineY}
                y2={lineY}
                stroke={CHART_COLORS.line}
                strokeWidth={CHART_STROKE.grid}
                strokeDasharray={CHART_STROKE.gridDash}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              d={path}
              fill="none"
              stroke={CHART_COLORS.ink}
              strokeWidth={CHART_STROKE.line}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Zero-length round-capped strokes stay circles when the chart stretches. */}
            {points.map((point, index) => (
              <path
                key={`${point.date}-${index}`}
                d={`M${x(index).toFixed(2)} ${y(point.value).toFixed(2)} h0`}
                stroke={index === points.length - 1 ? CHART_COLORS.ink : CHART_COLORS.ink2}
                strokeWidth={index === points.length - 1 ? 7 : 5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 flex justify-between ps-20 font-mono text-xs tabular-nums text-ink-3">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </figure>
  );
}

export default ExerciseProgressChart;
