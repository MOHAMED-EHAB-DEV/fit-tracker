"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EventFormValues, HabitOption } from "./types";
import EventForm, { emptyEventForm, validateEventForm } from "./EventForm";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDateString } from "@/lib/time";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to an error message, or null on success. */
  onAddEvent: (values: EventFormValues) => Promise<string | null>;
  availableHabits: HabitOption[];
  targetDate: string;
}

const FORM_ID = "planner-add-event-form";

export default function AddEventModal({ isOpen, onClose, onAddEvent, availableHabits, targetDate }: AddEventModalProps) {
  const [values, setValues] = useState<EventFormValues>(emptyEventForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    if (isSubmitting) return;
    setValues(emptyEventForm());
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (isSubmitting) return;
    const problem = validateEventForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const failure = await onAddEvent({ ...values, title: values.title.trim(), description: values.description.trim() });
    setIsSubmitting(false);
    if (failure) {
      setError(failure);
      return;
    }
    setValues(emptyEventForm());
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Add event"
      description={`For ${formatDateString(targetDate, { weekday: "long", month: "long", day: "numeric" })}`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="md" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            variant="solid"
            size="md"
            isLoading={isSubmitting}
            startContent={<Plus className="w-4 h-4" />}
          >
            Add event
          </Button>
        </div>
      }
    >
      <EventForm
        formId={FORM_ID}
        values={values}
        onChange={setValues}
        onSubmit={submit}
        availableHabits={availableHabits}
        error={error}
        autoFocusTitle
      />
    </Modal>
  );
}
