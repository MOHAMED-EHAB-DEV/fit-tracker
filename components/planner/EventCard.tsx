"use client";

import React from "react";
import { Check, Loader2, Repeat } from "lucide-react";
import { PlannedEventItem, CATEGORY_CONFIG, RECURRENCE_LABEL } from "./types";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: PlannedEventItem;
  onToggleComplete: (event: PlannedEventItem) => void;
  onSelect: (event: PlannedEventItem) => void;
  isToggling?: boolean;
}

/**
 * One planned event in the timeline: time (mono), the event's colour as a
 * 3px bar, title and details (tap to open), and the done tick.
 */
export default function EventCard({ event, onToggleComplete, onSelect, isToggling = false }: EventCardProps) {
  const config = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const timeLabel = event.endTime ? `${event.startTime} to ${event.endTime}` : event.startTime;
  const details = [
    config.label,
    event.recurrence !== "once" ? RECURRENCE_LABEL[event.recurrence] : null,
    event.linkedHabitIds.length > 0 ? event.linkedHabitIds.map((habit) => `${habit.emoji} ${habit.name}`).join(", ") : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2 pe-3">
      <button
        type="button"
        onClick={() => onSelect(event)}
        aria-haspopup="dialog"
        aria-label={`${event.title}, ${timeLabel}${event.isCompleted ? ", done" : ""}. Open`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 ps-3 text-start transition-colors hover:bg-elevated/60 cursor-pointer"
      >
        <span className="w-[52px] shrink-0 text-end font-mono text-xs leading-4 tabular-nums" aria-hidden="true">
          <span className={cn("block", event.isCompleted ? "text-ink-3" : "text-ink")}>{event.startTime}</span>
          {event.endTime && <span className="block text-ink-3">{event.endTime}</span>}
        </span>
        <span aria-hidden="true" className="h-9 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: event.color || config.defaultColor }} />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", event.isCompleted ? "text-ink-3 line-through" : "text-ink")}>
            {event.title}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-ink-3">
            {event.recurrence !== "once" && <Repeat className="h-3 w-3 shrink-0" aria-hidden="true" />}
            <span className="truncate">{details.join(" · ")}</span>
          </span>
        </span>
      </button>
      <button
        type="button"
        disabled={isToggling}
        onClick={() => onToggleComplete(event)}
        role="checkbox"
        aria-checked={event.isCompleted}
        aria-busy={isToggling || undefined}
        aria-label={`Done: ${event.title}`}
        className={cn(
          "relative grid h-7 w-7 shrink-0 place-items-center rounded-chip border-[1.5px] transition-colors disabled:cursor-wait cursor-pointer before:absolute before:-inset-2 before:content-['']",
          event.isCompleted ? "border-ink bg-ink text-ink-inverse" : "border-line-strong hover:border-ink-3"
        )}
      >
        {isToggling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          event.isCompleted && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
