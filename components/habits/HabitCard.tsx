"use client";

import React, { useId } from "react";
import { Archive, Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitDTO } from "@/lib/habits/dto";
import { DEFAULT_HABIT_EMOJI, safeHabitColor } from "@/lib/habits/colors";

/** @deprecated Use HabitDTO from "@/lib/habits/dto". */
export type IHabitData = HabitDTO;

interface HabitCardProps {
  habit: HabitDTO;
  isChecked: boolean;
  isPending?: boolean;
  /** Disables ticking (e.g. a day before the habit existed). */
  disabledReason?: string | null;
  onToggle: (habitId: string, checked: boolean) => void;
  onEdit?: (habit: HabitDTO) => void;
  onArchive?: (habit: HabitDTO) => void;
}

export function HabitCard({
  habit,
  isChecked,
  isPending = false,
  disabledReason = null,
  onToggle,
  onEdit,
  onArchive,
}: HabitCardProps) {
  const habitColor = safeHabitColor(habit.color);
  const disabled = isPending || Boolean(disabledReason);
  const descriptionId = useId();
  const description = habit.description?.trim() || "";

  return (
    <div
      className={cn(
        "flex items-stretch rounded-2xl border transition-colors duration-200",
        isChecked ? "bg-zinc-900/90 border-zinc-700/80" : "bg-zinc-900/40 border-zinc-800/80"
      )}
      style={{ boxShadow: isChecked ? `0 0 15px -3px ${habitColor}22` : undefined }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        aria-busy={isPending}
        aria-label={`${habit.name}: ${isChecked ? "completed" : "not completed"}${disabledReason ? ` (${disabledReason})` : ""}`}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onToggle(habit._id, !isChecked)}
        className="flex-1 min-w-0 flex items-center gap-3.5 p-3.5 sm:p-4 text-start rounded-s-2xl cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <span
          aria-hidden="true"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ backgroundColor: `${habitColor}18`, border: `1px solid ${habitColor}33` }}
        >
          {habit.emoji || DEFAULT_HABIT_EMOJI}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-bold text-sm tracking-tight truncate",
              isChecked ? "text-zinc-300 line-through" : "text-zinc-100"
            )}
          >
            {habit.name}
          </span>
          {description && (
            <span id={descriptionId} className="mt-0.5 text-xs text-zinc-400 line-clamp-2 break-words">
              {description}
            </span>
          )}
          <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: habitColor }}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: habitColor }} />
            {disabledReason || (isChecked ? "Completed" : "Daily habit")}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 transition-colors",
            isChecked ? "border-transparent text-zinc-950" : "border-zinc-600 bg-zinc-800/40"
          )}
          style={{ backgroundColor: isChecked ? habitColor : undefined }}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
          ) : (
            isChecked && <Check className="w-4 h-4 stroke-3" />
          )}
        </span>
      </button>

      {(onEdit || onArchive) && (
        <div className="flex items-center gap-0.5 pe-1.5 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(habit)}
              aria-label={`Edit ${habit.name}`}
              className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={() => onArchive(habit)}
              aria-label={`Archive ${habit.name}`}
              className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <Archive className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
