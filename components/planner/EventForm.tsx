"use client";

import { useId } from "react";
import { CheckCircle2, Circle, Repeat, Info } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  CATEGORY_CONFIG,
  EventCategory,
  EventFormValues,
  HabitOption,
  RECURRENCE_OPTIONS,
  isEndAfterStart,
  normalizeTime,
} from "./types";

export function emptyEventForm(): EventFormValues {
  return {
    title: "",
    description: "",
    startTime: "09:00",
    endTime: "",
    category: "workout",
    color: CATEGORY_CONFIG.workout.defaultColor,
    recurrence: "once",
    linkedHabitIds: [],
  };
}

/** A user-facing problem with the form, or null when it can be saved. */
export function validateEventForm(values: EventFormValues): string | null {
  if (!values.title.trim()) return "Give the event a title.";
  if (values.title.trim().length > 120) return "Keep the title under 120 characters.";
  if (!normalizeTime(values.startTime)) return "Choose a start time.";
  if (values.endTime && !normalizeTime(values.endTime)) return "The end time is not valid.";
  if (values.endTime && !isEndAfterStart(values.startTime, values.endTime)) {
    return "The end time must be after the start time.";
  }
  if (values.description.length > 1000) return "Keep the notes under 1000 characters.";
  return null;
}

interface EventFormProps {
  formId: string;
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
  onSubmit: () => void;
  availableHabits: HabitOption[];
  error: string | null;
  autoFocusTitle?: boolean;
}

const labelClass = "block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5";

export default function EventForm({
  formId,
  values,
  onChange,
  onSubmit,
  availableHabits,
  error,
  autoFocusTitle,
}: EventFormProps) {
  const ids = useId();
  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    onChange({ ...values, [key]: value });

  const toggleHabit = (habitId: string) =>
    set(
      "linkedHabitIds",
      values.linkedHabitIds.includes(habitId)
        ? values.linkedHabitIds.filter((id) => id !== habitId)
        : [...values.linkedHabitIds, habitId]
    );

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      {error && (
        <p role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm">
          {error}
        </p>
      )}

      <Input
        label="Title"
        required
        autoFocus={autoFocusTitle}
        maxLength={120}
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="e.g. Upper body push session"
      />

      <fieldset>
        <legend className={labelClass}>Category</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const isSelected = values.category === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange({ ...values, category: cat, color: cfg.defaultColor })}
                className={`px-3 min-h-11 rounded-xl text-sm font-medium border transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isSelected
                    ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.borderCol} ring-1 ring-emerald-500/50`
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${ids}-start`}
          label="Start time"
          type="time"
          required
          value={values.startTime}
          onChange={(e) => set("startTime", e.target.value)}
        />
        <Input
          id={`${ids}-end`}
          label="End time (optional)"
          type="time"
          value={values.endTime}
          onChange={(e) => set("endTime", e.target.value)}
        />
      </div>

      <fieldset>
        <legend className={`${labelClass} flex items-center gap-1.5`}>
          <Repeat className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          Repeats
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {RECURRENCE_OPTIONS.map((opt) => {
            const isSelected = values.recurrence === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => set("recurrence", opt.value)}
                className={`min-h-11 px-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Textarea
        id={`${ids}-notes`}
        label="Notes"
        rows={2}
        maxLength={1000}
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Optional details or targets"
      />

      {availableHabits.length > 0 && (
        <fieldset>
          <legend className={labelClass}>Linked habits</legend>
          <p className="flex items-start gap-1.5 text-xs text-zinc-400 mb-2">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-400" aria-hidden="true" />
            Marking the event done also ticks these habits for that day.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-0.5">
            {availableHabits.map((habit) => {
              const isLinked = values.linkedHabitIds.includes(habit._id);
              return (
                <button
                  key={habit._id}
                  type="button"
                  role="checkbox"
                  aria-checked={isLinked}
                  onClick={() => toggleHabit(habit._id)}
                  className={`flex items-center justify-between px-3 min-h-11 rounded-xl text-sm border text-start transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isLinked
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="truncate">
                    <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                  </span>
                  {isLinked ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ms-1" aria-hidden="true" />
                  ) : (
                    <Circle className="w-4 h-4 text-zinc-500 shrink-0 ms-1" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </form>
  );
}
