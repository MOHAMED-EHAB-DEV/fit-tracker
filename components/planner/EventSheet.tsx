"use client";

import React, { useState } from "react";
import { Check, Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import EventForm, { emptyEventForm, validateEventForm } from "./EventForm";
import { CATEGORY_CONFIG, EventFormValues, HabitOption, PlannedEventItem, RECURRENCE_LABEL, normalizeTime } from "./types";
import { formatDateString } from "@/lib/time";

export type DeleteMode = "this" | "following" | "all";

export type EventSheetState = { mode: "create" } | { mode: "event"; event: PlannedEventItem } | null;

interface EventSheetProps {
  isOpen: boolean;
  /** What the sheet shows; kept while it slides away. */
  state: EventSheetState;
  onClose: () => void;
  /** The day new events go to. */
  targetDate: string;
  /** Each resolves to an error message, or null on success. */
  onAdd: (values: EventFormValues) => Promise<string | null>;
  onUpdate: (id: string, values: EventFormValues) => Promise<string | null>;
  onDelete: (id: string, mode: DeleteMode) => Promise<string | null>;
  onToggleComplete: (event: PlannedEventItem) => void;
  isToggling: boolean;
  availableHabits: HabitOption[];
}

const FORM_ID = "planner-event-form";

function formFromEvent(event: PlannedEventItem): EventFormValues {
  return {
    title: event.title,
    description: event.description || "",
    // Older AI events may hold "7:30 PM"; the form and the API use HH:MM.
    startTime: normalizeTime(event.startTime) || "09:00",
    endTime: normalizeTime(event.endTime) || "",
    category: event.category,
    color: event.color,
    recurrence: event.recurrence,
    linkedHabitIds: event.linkedHabitIds.map((habit) => habit._id),
  };
}

/**
 * One sheet for a planner event: its details with Mark done, Edit and Delete
 * (repeating events ask which days); the same form to edit or add one.
 */
export default function EventSheet(props: EventSheetProps) {
  // A fresh sheet for every event (or "new") that is opened.
  const key = props.state ? (props.state.mode === "create" ? "new" : `${props.state.event._id}:${props.state.event.occurrenceDate}`) : "none";
  return <EventSheetInner key={key} {...props} />;
}

function EventSheetInner({
  isOpen,
  state,
  onClose,
  targetDate,
  onAdd,
  onUpdate,
  onDelete,
  onToggleComplete,
  isToggling,
  availableHabits,
}: EventSheetProps) {
  const event = state?.mode === "event" ? state.event : null;
  const [values, setValues] = useState<EventFormValues | null>(() => (state?.mode === "create" ? emptyEventForm() : null));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isCreate = state?.mode === "create";
  const isEditing = values !== null;
  const isRecurring = Boolean(event && event.recurrence !== "once");

  const close = () => {
    if (isSaving || isDeleting) return;
    onClose();
  };

  const cancelEdit = () => {
    if (isCreate) {
      close();
      return;
    }
    setValues(null);
    setFormError(null);
  };

  const save = async () => {
    if (!values || isSaving) return;
    const problem = validateEventForm(values);
    if (problem) {
      setFormError(problem);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    const clean = { ...values, title: values.title.trim(), description: values.description.trim() };
    const failure = event ? await onUpdate(event._id, clean) : await onAdd(clean);
    setIsSaving(false);
    if (failure) {
      setFormError(failure);
      return;
    }
    if (isCreate) onClose();
    else setValues(null);
  };

  const remove = async (mode: DeleteMode) => {
    if (!event || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    const failure = await onDelete(event._id, mode);
    setIsDeleting(false);
    if (failure) setDeleteError(failure);
  };

  let title: React.ReactNode = "New event";
  let description: React.ReactNode = `For ${formatDateString(targetDate, { weekday: "long", month: "long", day: "numeric" })}`;
  if (event) {
    title = isEditing ? "Edit event" : event.title;
    description = isEditing
      ? isRecurring
        ? "Changes apply to every day this event repeats."
        : undefined
      : `${formatDateString(event.occurrenceDate, { weekday: "long", month: "long", day: "numeric" })}`;
  }

  const footer = isEditing ? (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button variant="secondary" disabled={isSaving} onClick={cancelEdit}>
        Cancel
      </Button>
      <Button type="submit" form={FORM_ID} isLoading={isSaving}>
        {isCreate ? "Add event" : "Save"}
      </Button>
    </div>
  ) : event ? (
    <div className="flex w-full items-center justify-between gap-2">
      <Button
        variant="ghost"
        className="text-danger hover:text-danger"
        startContent={<Trash2 className="h-4 w-4" />}
        aria-expanded={deleteOpen}
        disabled={isDeleting}
        onClick={() => {
          setDeleteOpen((open) => !open);
          setDeleteError(null);
        }}
      >
        Delete
      </Button>
      <Button
        variant="secondary"
        startContent={<Pencil className="h-4 w-4" />}
        onClick={() => {
          setValues(formFromEvent(event));
          setDeleteOpen(false);
        }}
      >
        Edit
      </Button>
    </div>
  ) : undefined;

  return (
    <Sheet isOpen={isOpen && Boolean(state)} onClose={close} title={title} description={description} footer={footer} closeOnBackdropClick={!isEditing}>
      {isEditing && values ? (
        <EventForm
          formId={FORM_ID}
          values={values}
          onChange={setValues}
          onSubmit={() => void save()}
          availableHabits={availableHabits}
          error={formError}
          autoFocusTitle={isCreate}
        />
      ) : (
        event && (
          <div className="space-y-4">
            {deleteOpen && (
              <div role="group" aria-label="Delete options" className="space-y-2 rounded-control border border-line bg-surface p-3">
                <p className="text-sm text-ink">
                  {isRecurring ? `"${event.title}" repeats. What should be removed?` : `Delete "${event.title}"? This cannot be undone.`}
                </p>
                {deleteError && (
                  <p role="alert" className="text-sm text-danger">
                    {deleteError}
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  {isRecurring && (
                    <>
                      <Button variant="secondary" disabled={isDeleting} onClick={() => void remove("this")} className="justify-start">
                        Only {formatDateString(event.occurrenceDate)}
                      </Button>
                      <Button variant="secondary" disabled={isDeleting} onClick={() => void remove("following")} className="justify-start">
                        {formatDateString(event.occurrenceDate)} and every later day
                      </Button>
                    </>
                  )}
                  <Button variant="danger" isLoading={isDeleting} onClick={() => void remove("all")} className="justify-start">
                    {isRecurring ? "The whole series, past days too" : "Delete event"}
                  </Button>
                  <Button variant="ghost" disabled={isDeleting} onClick={() => setDeleteOpen(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            )}

            <dl className="divide-y divide-line overflow-hidden rounded-control border border-line bg-surface text-sm">
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="text-ink-3">Time</dt>
                <dd className="font-mono tabular-nums text-ink">
                  {event.startTime}
                  {event.endTime ? ` – ${event.endTime}` : ""}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="text-ink-3">Category</dt>
                <dd className="flex items-center gap-1.5 text-ink">
                  <span aria-hidden="true" className="h-3 w-[3px] rounded-full" style={{ backgroundColor: event.color }} />
                  {(CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other).label}
                </dd>
              </div>
              {isRecurring && (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <dt className="text-ink-3">Repeats</dt>
                  <dd className="flex items-center gap-1.5 text-end text-ink">
                    <Repeat className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                    {RECURRENCE_LABEL[event.recurrence]} since {formatDateString(event.date)}
                    {event.endDate ? `, until ${formatDateString(event.endDate)}` : ""}
                  </dd>
                </div>
              )}
              {event.linkedHabitIds.length > 0 && (
                <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <dt className="text-ink-3">Ticks habits</dt>
                  <dd className="text-end text-ink">
                    {event.linkedHabitIds.map((habit) => (
                      <span key={habit._id} className="block">
                        <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {event.description && (
              <p className="whitespace-pre-wrap break-words rounded-control border border-line bg-surface px-3 py-2.5 text-sm leading-5 text-ink-2">
                {event.description}
              </p>
            )}

            <Button
              fullWidth
              size="lg"
              variant={event.isCompleted ? "secondary" : "primary"}
              isLoading={isToggling}
              startContent={<Check className="h-4 w-4" />}
              onClick={() => onToggleComplete(event)}
            >
              {event.isCompleted ? "Mark as not done" : "Mark as done"}
            </Button>
          </div>
        )
      )}
    </Sheet>
  );
}
