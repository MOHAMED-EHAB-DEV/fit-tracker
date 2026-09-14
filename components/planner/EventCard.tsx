"use client";

import { useMemo } from "react";
import {
  Check,
  Clock,
  Dumbbell,
  Utensils,
  Zap,
  HeartPulse,
  Sparkles,
  Bell,
  Repeat,
} from "lucide-react";
import { PlannedEventItem, CATEGORY_CONFIG } from "./types";
import { triggerSystemNotification } from "@/services/webview-bridge";

interface EventCardProps {
  event: PlannedEventItem;
  onToggleComplete: (event: PlannedEventItem) => void;
  onSelect: (event: PlannedEventItem) => void;
  isToggling?: boolean;
}

export default function EventCard({
  event,
  onToggleComplete,
  onSelect,
  isToggling = false,
}: EventCardProps) {
  const config = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;

  const CategoryIcon = useMemo(() => {
    switch (event.category) {
      case "workout":
        return Dumbbell;
      case "nutrition":
        return Utensils;
      case "habit":
        return Zap;
      case "recovery":
        return HeartPulse;
      case "focus":
        return Sparkles;
      default:
        return Clock;
    }
  }, [event.category]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(event);
  };

  const handleNotifyTest = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerSystemNotification({
      id: event._id,
      title: event.title,
      description: event.description || `Scheduled for ${event.startTime}`,
      category: event.category,
    });
  };

  return (
    <div
      onClick={() => onSelect(event)}
      style={{ borderInlineStartColor: event.color || config.defaultColor }}
      className={`group relative flex items-start gap-3.5 p-4 rounded-2xl bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800/80 border-s-4 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:border-zinc-700/70 ${
        event.isCompleted ? "opacity-60 bg-zinc-950/60" : ""
      }`}
    >
      {/* Time & Category Pillar */}
      <div className="flex flex-col items-start gap-1.5 shrink-0 pt-0.5">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-950/80 border border-zinc-800/60 text-xs font-mono font-medium text-zinc-300">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span>{event.startTime}</span>
          {event.endTime && <span className="text-zinc-500">→ {event.endTime}</span>}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.badgeBg} ${config.badgeText} ${config.borderCol}`}
          >
            <CategoryIcon className="w-3 h-3 shrink-0" />
            <span>{config.label}</span>
          </div>

          {event.recurrence && event.recurrence !== "once" && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Repeat className="w-2.5 h-2.5" />
              <span>{event.recurrence}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1 text-start">
        <h4
          className={`text-sm sm:text-base font-semibold text-zinc-100 transition-colors line-clamp-1 ${
            event.isCompleted ? "line-through text-zinc-400" : "group-hover:text-emerald-400"
          }`}
        >
          {event.title}
        </h4>

        {event.description && (
          <p className="text-xs text-zinc-400 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Linked Habits */}
        {event.linkedHabitIds && event.linkedHabitIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {event.linkedHabitIds.map((habit: any) => {
              const name = habit?.name || "Habit";
              const emoji = habit?.emoji || "⚡";
              const key = habit?._id ? String(habit._id) : String(habit);
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800/90 text-zinc-200 border border-zinc-700/60"
                >
                  <span>{emoji}</span>
                  <span>{name}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions: Test Notify & Completion Checkbox */}
      <div className="flex items-center gap-2 ms-auto shrink-0 pt-0.5">
        <button
          type="button"
          onClick={handleNotifyTest}
          title="Send notification now"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80"
        >
          <Bell className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={isToggling}
          onClick={handleCheckboxClick}
          aria-label={event.isCompleted ? "Mark incomplete" : "Mark complete"}
          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
            event.isCompleted
              ? "bg-emerald-500 border-emerald-400 text-zinc-950 shadow-sm shadow-emerald-500/30"
              : "border-zinc-700 bg-zinc-800/60 text-transparent hover:border-emerald-500 hover:text-emerald-400/50"
          }`}
        >
          <Check className={`w-4 h-4 stroke-3 ${event.isCompleted ? "scale-100" : "scale-75 opacity-0 hover:opacity-100"}`} />
        </button>
      </div>
    </div>
  );
}
