"use client";

import { useState } from "react";
import { Clock, Trash2, Edit3, CheckCircle2, Save, Calendar, Repeat } from "lucide-react";
import { PlannedEventItem, HabitOption, EventFormValues, CATEGORY_CONFIG, RECURRENCE_LABEL, normalizeTime } from "./types";
import EventForm, { validateEventForm } from "./EventForm";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { formatDateString } from "@/lib/time";

export type DeleteMode = "this" | "following" | "all";

interface EventDrawerProps {
  /** The event shown; kept while the drawer animates closed. */
  event: PlannedEventItem | null;
  isOpen: boolean;
  onClose: () => void;
  /** Each resolves to an error message, or null on success. */
  onUpdate: (id: string, values: EventFormValues) => Promise<string | null>;
  onDelete: (id: string, mode: DeleteMode) => Promise<string | null>;
  onToggleComplete: (event: PlannedEventItem) => void;
  isToggling: boolean;
  availableHabits: HabitOption[];
}

const FORM_ID = "planner-edit-event-form";

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

const longDate = (date: string) => formatDateString(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export default function EventDrawer({
  event,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onToggleComplete,
  isToggling,
  availableHabits,
}: EventDrawerProps) {
  const [editValues, setEditValues] = useState<EventFormValues | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [shownEventKey, setShownEventKey] = useState<string | null>(null);

  // Reset local state whenever a different event/occurrence is shown.
  const eventKey = event ? `${event._id}:${event.occurrenceDate}` : null;
  if (eventKey !== shownEventKey) {
    setShownEventKey(eventKey);
    setEditValues(null);
    setFormError(null);
    setShowDeleteConfirm(false);
    setDeleteError(null);
  }

  if (!event) return null;

  const isEditing = editValues !== null;
  const isRecurring = event.recurrence !== "once";
  const config = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;

  const cancelEdit = () => {
    setEditValues(null);
    setFormError(null);
  };

  const close = () => {
    if (isSaving || isDeleting) return;
    cancelEdit();
    setShowDeleteConfirm(false);
    onClose();
  };

  const save = async () => {
    if (!editValues || isSaving) return;
    const problem = validateEventForm(editValues);
    if (problem) {
      setFormError(problem);
      return;
    }
    setIsSaving(true);
    setFormError(null);
    const failure = await onUpdate(event._id, {
      ...editValues,
      title: editValues.title.trim(),
      description: editValues.description.trim(),
    });
    setIsSaving(false);
    if (failure) setFormError(failure);
    else setEditValues(null);
  };

  const remove = async (mode: DeleteMode) => {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    const failure = await onDelete(event._id, mode);
    setIsDeleting(false);
    if (failure) setDeleteError(failure);
    else setShowDeleteConfirm(false);
  };

  const title = (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-lg border ${config.badgeBg} ${config.badgeText} ${config.borderCol}`}>
        {config.label}
      </span>
      {isRecurring && (
        <span className="flex items-center gap-1 text-xs font-medium text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
          <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
          {RECURRENCE_LABEL[event.recurrence]}
        </span>
      )}
      {event.isCompleted && (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Done
        </span>
      )}
    </div>
  );

  const footer = isEditing ? (
    <div className="w-full flex items-center justify-end gap-2">
      <Button variant="ghost" size="md" disabled={isSaving} onClick={cancelEdit}>
        Cancel
      </Button>
      <Button type="submit" form={FORM_ID} variant="solid" size="md" isLoading={isSaving} startContent={<Save className="w-4 h-4" />}>
        Save
      </Button>
    </div>
  ) : (
    <div className="w-full flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="md"
        disabled={isDeleting}
        aria-expanded={showDeleteConfirm}
        onClick={() => {
          setShowDeleteConfirm((value) => !value);
          setDeleteError(null);
        }}
        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
        startContent={<Trash2 className="w-4 h-4" />}
      >
        Delete
      </Button>
      <Button
        variant="bordered"
        size="md"
        onClick={() => {
          setEditValues(formFromEvent(event));
          setShowDeleteConfirm(false);
        }}
        startContent={<Edit3 className="w-4 h-4" />}
      >
        Edit
      </Button>
    </div>
  );

  return (
    <Drawer isOpen={isOpen} onClose={close} position="left" title={title} footer={footer} className="w-full sm:max-w-md bg-zinc-950/98">
      <div className="space-y-6">
        {showDeleteConfirm && !isEditing && (
          <div role="group" aria-label="Delete options" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-3">
            <p className="text-sm text-zinc-200">
              {isRecurring
                ? `"${event.title}" repeats. What should be removed?`
                : `Delete "${event.title}"? This cannot be undone.`}
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-rose-300">
                {deleteError}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {isRecurring && (
                <>
                  <Button variant="bordered" size="md" disabled={isDeleting} onClick={() => remove("this")} className="justify-start border-rose-500/30 text-rose-200">
                    Only {formatDateString(event.occurrenceDate)}
                  </Button>
                  <Button variant="bordered" size="md" disabled={isDeleting} onClick={() => remove("following")} className="justify-start border-rose-500/30 text-rose-200">
                    {formatDateString(event.occurrenceDate)} and every later day
                  </Button>
                </>
              )}
              <Button variant="danger" size="md" isLoading={isDeleting} onClick={() => remove("all")} className="justify-start">
                {isRecurring ? "The whole series, including past days" : "Delete event"}
              </Button>
              <Button variant="ghost" size="md" disabled={isDeleting} onClick={() => setShowDeleteConfirm(false)}>
                Keep it
              </Button>
            </div>
          </div>
        )}

        {isEditing && editValues ? (
          <>
            {isRecurring && (
              <p className="text-xs text-zinc-400">
                Changes apply to every occurrence of this repeating event.
              </p>
            )}
            <EventForm
              formId={FORM_ID}
              values={editValues}
              onChange={setEditValues}
              onSubmit={save}
              availableHabits={availableHabits}
              error={formError}
            />
          </>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className={`text-xl font-bold break-words ${event.isCompleted ? "line-through text-zinc-400" : "text-zinc-100"}`}>
                {event.title}
              </h3>
              <dl className="flex flex-wrap items-center gap-3 mt-2 text-sm text-zinc-400">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 font-mono">
                  <dt className="sr-only">Time</dt>
                  <Clock className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <dd>
                    {event.startTime}
                    {event.endTime && ` → ${event.endTime}`}
                  </dd>
                </div>
                <div className="flex items-center gap-1">
                  <dt className="sr-only">Day</dt>
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <dd>{longDate(event.occurrenceDate)}</dd>
                </div>
              </dl>
              {isRecurring && (
                <p className="mt-2 flex items-center gap-1 text-sm text-blue-300">
                  <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                  Repeats {RECURRENCE_LABEL[event.recurrence].toLowerCase()} since {formatDateString(event.date)}
                  {event.endDate ? `, until ${formatDateString(event.endDate)}` : ""}
                </p>
              )}
            </div>

            {event.description && (
              <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed break-words">{event.description}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Linked habits</h4>
              {event.linkedHabitIds.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {event.linkedHabitIds.map((habit) => (
                    <li
                      key={habit._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-200"
                    >
                      <span aria-hidden="true">{habit.emoji}</span>
                      {habit.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">No habits linked.</p>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800/80">
              <Button
                variant={event.isCompleted ? "bordered" : "solid"}
                size="lg"
                isLoading={isToggling}
                onClick={() => onToggleComplete(event)}
                className="w-full"
                startContent={<CheckCircle2 className="w-4 h-4" />}
              >
                {event.isCompleted ? "Mark as not done" : "Mark as done"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
