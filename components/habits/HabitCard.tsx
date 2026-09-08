"use client";

import React, { useState } from "react";
import { Check, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IHabitData {
  _id: string;
  name: string;
  emoji: string;
  color: string;
  order?: number;
}

interface HabitCardProps {
  habit: IHabitData;
  isChecked: boolean;
  onToggle: (habitId: string) => Promise<void>;
  onEdit?: (habit: IHabitData) => void;
  onDelete?: (habitId: string) => Promise<void>;
}

export function HabitCard({ habit, isChecked, onToggle, onEdit, onDelete }: HabitCardProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCheck = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onToggle(habit._id);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(habit._id);
    } finally {
      setDeleting(false);
    }
  };

  // Safe color parsing for accents
  const habitColor = habit.color || "#10b981";

  return (
    <div
      onClick={handleCheck}
      className={cn(
        "group relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none",
        isChecked
          ? "bg-zinc-900/90 border-zinc-700/80 shadow-sm"
          : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/70 hover:border-zinc-700/50"
      )}
      style={{
        boxShadow: isChecked ? `0 0 15px -3px ${habitColor}22` : undefined,
      }}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Habit Icon / Emoji Container */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-105"
          style={{
            backgroundColor: `${habitColor}18`,
            border: `1px solid ${habitColor}33`,
          }}
        >
          <span>{habit.emoji || "⚡"}</span>
        </div>

        {/* Habit Details */}
        <div className="min-w-0">
          <h4
            className={cn(
              "font-bold text-sm tracking-tight truncate transition-colors",
              isChecked ? "text-zinc-100 line-through opacity-80" : "text-zinc-100"
            )}
          >
            {habit.name}
          </h4>
          <span
            className="text-[11px] font-medium tracking-wide flex items-center gap-1.5"
            style={{ color: habitColor }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: habitColor }}
            />
            {isChecked ? "Completed today" : "Daily habit"}
          </span>
        </div>
      </div>

      {/* Actions: Delete on hover (on the left of edit), Edit (next to check), Checkbox */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete habit"
            aria-label="Delete habit"
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(habit);
            }}
            title="Edit habit"
            aria-label="Edit habit"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* Checkbox */}
        <button
          type="button"
          onClick={handleCheck}
          aria-label={isChecked ? "Mark incomplete" : "Mark complete"}
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 border cursor-pointer",
            isChecked
              ? "border-transparent text-zinc-950 font-bold scale-100"
              : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-500"
          )}
          style={{
            backgroundColor: isChecked ? habitColor : undefined,
          }}
        >
          {isChecked && <Check className="w-4 h-4 stroke-3" />}
        </button>
      </div>
    </div>
  );
}
