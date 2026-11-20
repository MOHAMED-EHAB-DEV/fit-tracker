"use client";

import { Calendar, CheckCircle2 } from "lucide-react";
import EventCard from "./EventCard";
import { PlannedEventItem, nowMarkerIndex } from "./types";
import { formatDateString } from "@/lib/time";

interface PlannerTimelineProps {
  events: PlannedEventItem[];
  selectedDate: string; // YYYY-MM-DD
  isToday: boolean;
  /** Current HH:MM in the user's zone ("" until known). */
  nowTime: string;
  togglingIds: ReadonlySet<string>;
  onToggleComplete: (event: PlannedEventItem) => void;
  onSelectEvent: (event: PlannedEventItem) => void;
}

function NowMarker({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2 my-2 py-1" aria-label={`Current time ${time}`}>
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
      </span>
      <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">Now ({time})</span>
      <div className="flex-1 border-t border-dashed border-rose-500/50" aria-hidden="true" />
    </div>
  );
}

export default function PlannerTimeline({
  events,
  selectedDate,
  isToday,
  nowTime,
  togglingIds,
  onToggleComplete,
  onSelectEvent,
}: PlannerTimelineProps) {
  const totalCount = events.length;
  const completedCount = events.filter((event) => event.isCompleted).length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nowIndex = isToday && nowTime ? nowMarkerIndex(events, nowTime) : -1;

  if (events.length === 0) {
    return (
      <div className="py-14 px-4 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/80 border-dashed flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-3">
          <Calendar className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-zinc-200">
          Nothing planned for {formatDateString(selectedDate, { weekday: "long", month: "short", day: "numeric" })}
        </h2>
        <p className="text-sm text-zinc-400 max-w-sm mt-1">
          Use <span className="font-semibold text-zinc-200">Add event</span> or{" "}
          <span className="font-semibold text-zinc-200">Plan with AI</span> above to build the day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
          <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100" aria-live="polite">
              {completedCount} of {totalCount} done
            </span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-800 text-emerald-400 border border-zinc-700">
              {percent}%
            </span>
          </div>
          <div
            className="w-full max-w-60 h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Day progress"
          >
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <ul className="relative space-y-3 pt-1" aria-label="Planned events">
        {events.map((event, index) => (
          <li key={event._id}>
            {index === nowIndex && <NowMarker time={nowTime} />}
            <EventCard
              event={event}
              onToggleComplete={onToggleComplete}
              onSelect={onSelectEvent}
              isToggling={togglingIds.has(event._id)}
            />
          </li>
        ))}
        {nowIndex >= events.length && (
          <li>
            <NowMarker time={nowTime} />
          </li>
        )}
      </ul>
    </div>
  );
}
