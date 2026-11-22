"use client";

import React, { useId } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import {
  CATEGORY_CONFIG,
  EventCategory,
  EventFormValues,
  HabitOption,
  RECURRENCE_OPTIONS,
  RecurrenceType,
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

const LEGEND = "mb-1.5 text-[13px] font-medium text-ink-2";

/** Title, category, times, repeats, notes and linked habits of a planner event. */
export default function EventForm({ formId, values, onChange, onSubmit, availableHabits, error, autoFocusTitle }: EventFormProps) {
  const ids = useId();
  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => onChange({ ...values, [key]: value });
  const titleProblem = error === "Give the event a title." || error === "Keep the title under 120 characters." ? error : null;
  const timeProblem = error && /time/i.test(error) ? error : null;
  const otherProblem = error && !titleProblem && !timeProblem ? error : null;

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
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      {otherProblem && (
        <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          {otherProblem}
        </p>
      )}

      <Input
        label="Title"
        required
        data-autofocus={autoFocusTitle ? true : undefined}
        maxLength={120}
        value={values.title}
        onChange={(event) => set("title", event.target.value)}
        placeholder="Upper body session"
        isInvalid={Boolean(titleProblem)}
        errorMessage={titleProblem ?? undefined}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${ids}-start`}
          label="Starts"
          type="time"
          required
          value={values.startTime}
          onChange={(event) => set("startTime", event.target.value)}
          inputClassName="font-mono tabular-nums"
          isInvalid={Boolean(timeProblem) && !/end/i.test(timeProblem ?? "")}
        />
        <Input
          id={`${ids}-end`}
          label="Ends (optional)"
          type="time"
          value={values.endTime}
          onChange={(event) => set("endTime", event.target.value)}
          inputClassName="font-mono tabular-nums"
          isInvalid={Boolean(timeProblem) && /end/i.test(timeProblem ?? "")}
        />
        {timeProblem && (
          <p role="alert" className="col-span-2 -mt-1.5 text-xs text-danger">
            {timeProblem}
          </p>
        )}
      </div>

      <fieldset>
        <legend className={LEGEND}>Category</legend>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map((category) => {
            const config = CATEGORY_CONFIG[category];
            const selected = values.category === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...values, category, color: config.defaultColor })}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-chip border px-3 text-[13px] transition-colors cursor-pointer",
                  selected ? "border-ink bg-ink font-semibold text-ink-inverse" : "border-line bg-surface font-medium text-ink-2 hover:border-line-strong hover:text-ink"
                )}
              >
                <span aria-hidden="true" className="h-3 w-[3px] rounded-full" style={{ backgroundColor: config.defaultColor }} />
                {config.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <span className={cn(LEGEND, "block")}>Repeats</span>
        <SegmentedControl<RecurrenceType>
          label="Repeats"
          value={values.recurrence}
          options={RECURRENCE_OPTIONS}
          onChange={(recurrence) => set("recurrence", recurrence)}
          className="w-full"
        />
      </div>

      <Textarea
        id={`${ids}-notes`}
        label="Notes (optional)"
        rows={2}
        maxLength={1000}
        value={values.description}
        onChange={(event) => set("description", event.target.value)}
        placeholder="Details or targets"
      />

      {availableHabits.length > 0 && (
        <fieldset>
          <legend className={LEGEND}>Linked habits</legend>
          <p className="mb-2 text-xs text-ink-3">Marking the event done also ticks these habits for that day.</p>
          <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-2">
            {availableHabits.map((habit) => {
              const linked = values.linkedHabitIds.includes(habit._id);
              return (
                <button
                  key={habit._id}
                  type="button"
                  role="checkbox"
                  aria-checked={linked}
                  onClick={() => toggleHabit(habit._id)}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-2 rounded-control border px-3 text-start text-sm transition-colors cursor-pointer",
                    linked ? "border-line-strong bg-elevated text-ink" : "border-line bg-surface text-ink-2 hover:text-ink"
                  )}
                >
                  <span className="truncate">
                    <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border",
                      linked ? "border-ink bg-ink text-ink-inverse" : "border-line-strong"
                    )}
                  >
                    {linked && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </form>
  );
}
