"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitDTO } from "@/lib/habits/dto";
import { DEFAULT_HABIT_EMOJI, safeHabitColor } from "@/lib/habits/colors";

export interface HabitStripDay {
  dateString: string;
  /** Done that day. */
  done: boolean;
  /** The day being logged (accent when not yet done). */
  isSelected: boolean;
  /** Before the habit existed: no dot. */
  inactive: boolean;
}

interface HabitRowProps {
  habit: HabitDTO;
  isChecked: boolean;
  isPending?: boolean;
  /** Ticking is not possible (a day before the habit existed, still loading). */
  disabledReason?: string | null;
  /** The 7 days ending on the selected day, oldest first. */
  strip: HabitStripDay[];
  onToggle: (habitId: string, checked: boolean) => void;
  onEdit: (habit: HabitDTO) => void;
}

/**
 * One habit in the checklist: its colour as a 3px bar, emoji and name (tap
 * to edit), the last seven days as small bars, and the tick.
 */
export function HabitRow({ habit, isChecked, isPending = false, disabledReason = null, strip, onToggle, onEdit }: HabitRowProps) {
  const color = safeHabitColor(habit.color);
  const doneDays = strip.filter((day) => day.done).length;

  return (
    <li className="flex items-center gap-2 pe-3">
      <button
        type="button"
        onClick={() => onEdit(habit)}
        aria-haspopup="dialog"
        aria-label={`${habit.name}. Edit`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 py-2.5 ps-3 text-start transition-colors hover:bg-elevated/60 cursor-pointer"
      >
        <span aria-hidden="true" className="h-8 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0">
          <span className={cn("flex min-w-0 items-center gap-1.5 text-sm font-medium", isChecked ? "text-ink-2" : "text-ink")}>
            <span aria-hidden="true" className="text-sm leading-none">
              {habit.emoji || DEFAULT_HABIT_EMOJI}
            </span>
            <span className="truncate">{habit.name}</span>
          </span>
          <span className="mt-[5px] flex gap-1" aria-hidden="true">
            {strip.map((day) => (
              <span
                key={day.dateString}
                className={cn(
                  "h-1 w-3 rounded-[2px]",
                  day.inactive ? "bg-transparent" : day.done ? "bg-ink-2" : day.isSelected ? "bg-accent" : "bg-elevated"
                )}
              />
            ))}
          </span>
          <span className="sr-only">
            Done on {doneDays} of the last {strip.length} days.
            {disabledReason ? ` ${disabledReason}.` : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        aria-busy={isPending || undefined}
        aria-label={`${habit.name}: ${isChecked ? "done" : "not done"}${disabledReason ? ` (${disabledReason})` : ""}`}
        disabled={isPending || Boolean(disabledReason)}
        onClick={() => onToggle(habit._id, !isChecked)}
        className={cn(
          "relative grid h-7 w-7 shrink-0 place-items-center rounded-chip border-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer before:absolute before:-inset-2 before:content-['']",
          isChecked ? "border-ink bg-ink text-ink-inverse" : "border-line-strong hover:border-ink-3"
        )}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          isChecked && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

export default HabitRow;
