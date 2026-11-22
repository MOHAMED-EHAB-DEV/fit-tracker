"use client";

import React from "react";
import { CalendarDays } from "lucide-react";
import EventCard from "./EventCard";
import { PlannedEventItem, nowMarkerIndex } from "./types";
import { EmptyState } from "@/components/ui/EmptyState";

interface PlannerTimelineProps {
  events: PlannedEventItem[];
  isToday: boolean;
  /** Current HH:MM in the user's zone ("" until known). */
  nowTime: string;
  togglingIds: ReadonlySet<string>;
  onToggleComplete: (event: PlannedEventItem) => void;
  onSelectEvent: (event: PlannedEventItem) => void;
  /** Shown when the day is empty (Add event / Plan my day). */
  emptyActions?: React.ReactNode;
  dayLabel: string;
}

function NowMarker({ time }: { time: string }) {
  return (
    <li className="flex items-center gap-2 px-3 py-1" aria-label={`Now, ${time}`}>
      <span className="w-[52px] shrink-0 text-end font-mono text-xs font-medium tabular-nums text-accent">{time}</span>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
      <span aria-hidden="true" className="h-px flex-1 bg-accent" />
    </li>
  );
}

/** The day's events in time order, with a "now" line on today. */
export default function PlannerTimeline({
  events,
  isToday,
  nowTime,
  togglingIds,
  onToggleComplete,
  onSelectEvent,
  emptyActions,
  dayLabel,
}: PlannerTimelineProps) {
  const nowIndex = isToday && nowTime ? nowMarkerIndex(events, nowTime) : -1;

  if (events.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-5 w-5" />}
        title={`Nothing planned for ${dayLabel}`}
        description="Add events one by one, or let the coach suggest a plan you accept event by event."
        actions={emptyActions}
      />
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface" aria-label="Planned events">
      {events.map((event, index) => (
        <React.Fragment key={event._id}>
          {index === nowIndex && <NowMarker time={nowTime} />}
          <li>
            <EventCard
              event={event}
              onToggleComplete={onToggleComplete}
              onSelect={onSelectEvent}
              isToggling={togglingIds.has(event._id)}
            />
          </li>
        </React.Fragment>
      ))}
      {nowIndex >= events.length && <NowMarker time={nowTime} />}
    </ul>
  );
}
