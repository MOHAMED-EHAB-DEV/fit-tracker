"use client";

import { Check, Clock, Dumbbell, Utensils, Zap, HeartPulse, Sparkles, Repeat, Loader2 } from "lucide-react";
import { PlannedEventItem, CATEGORY_CONFIG, RECURRENCE_LABEL, EventCategory } from "./types";

interface EventCardProps {
  event: PlannedEventItem;
  onToggleComplete: (event: PlannedEventItem) => void;
  onSelect: (event: PlannedEventItem) => void;
  isToggling?: boolean;
}

const CATEGORY_ICON: Record<EventCategory, typeof Clock> = {
  workout: Dumbbell,
  nutrition: Utensils,
  habit: Zap,
  recovery: HeartPulse,
  focus: Sparkles,
  other: Clock,
};

export default function EventCard({ event, onToggleComplete, onSelect, isToggling = false }: EventCardProps) {
  const config = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const CategoryIcon = CATEGORY_ICON[event.category] || Clock;
  const timeLabel = event.endTime ? `${event.startTime} to ${event.endTime}` : event.startTime;

  return (
    <div
      style={{ borderInlineStartColor: event.color || config.defaultColor }}
      className={`relative flex items-stretch gap-2 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 border-s-4 transition-colors hover:border-zinc-700/70 ${
        event.isCompleted ? "opacity-70 bg-zinc-950/60" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(event)}
        aria-label={`${event.title}, ${timeLabel}. Open details`}
        className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3.5 p-4 text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
      >
        <div className="flex sm:flex-col items-center sm:items-start gap-1.5 shrink-0 flex-wrap">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-950/80 border border-zinc-800/60 text-xs font-mono font-medium text-zinc-300">
            <Clock className="w-3 h-3 text-zinc-400" aria-hidden="true" />
            <span>{event.startTime}</span>
            {event.endTime && <span className="text-zinc-400">→ {event.endTime}</span>}
          </span>
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${config.badgeBg} ${config.badgeText} ${config.borderCol}`}
          >
            <CategoryIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
            {config.label}
          </span>
          {event.recurrence !== "once" && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
              <Repeat className="w-3 h-3" aria-hidden="true" />
              {RECURRENCE_LABEL[event.recurrence]}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span
            className={`text-sm sm:text-base font-semibold break-words ${
              event.isCompleted ? "line-through text-zinc-400" : "text-zinc-100"
            }`}
          >
            {event.title}
          </span>
          {event.description && <span className="text-sm text-zinc-400 line-clamp-2">{event.description}</span>}
          {event.linkedHabitIds.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5 mt-1">
              {event.linkedHabitIds.map((habit) => (
                <span
                  key={habit._id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800/90 text-zinc-200 border border-zinc-700/60"
                >
                  <span aria-hidden="true">{habit.emoji}</span>
                  {habit.name}
                </span>
              ))}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center pe-3 shrink-0">
        <button
          type="button"
          disabled={isToggling}
          onClick={() => onToggleComplete(event)}
          role="checkbox"
          aria-checked={event.isCompleted}
          aria-busy={isToggling}
          aria-label={`Done: ${event.title}`}
          className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait ${
            event.isCompleted
              ? "bg-emerald-500 border-emerald-400 text-zinc-950"
              : "border-zinc-600 bg-zinc-800/60 text-zinc-500 hover:border-emerald-500"
          }`}
        >
          {isToggling ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className={`w-5 h-5 stroke-3 ${event.isCompleted ? "" : "opacity-30"}`} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
