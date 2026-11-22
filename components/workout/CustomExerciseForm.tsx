"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { api, errorMessage } from "@/lib/client/api";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  PRIMARY_MUSCLES,
  TRACKING_TYPES,
  TRACKING_TYPE_LABELS,
  type TrackingType,
} from "@/lib/workouts/taxonomy";
import type { ExerciseDTO } from "@/lib/workouts/types";

const EQUIPMENT_OPTIONS: SelectOption<string>[] = EQUIPMENT.map((item) => ({ value: item, label: EQUIPMENT_LABELS[item] }));
const MUSCLE_OPTIONS: SelectOption<string>[] = PRIMARY_MUSCLES.map((muscle) => ({ value: muscle, label: muscle }));
const TRACKING_OPTIONS: SelectOption<TrackingType>[] = TRACKING_TYPES.map((type) => ({
  value: type,
  label: TRACKING_TYPE_LABELS[type],
}));

const MAX_STEPS = 15;
const MAX_STEP_LENGTH = 500;

export interface CustomExerciseFormProps {
  /** Editing an existing custom exercise; creating when absent. */
  exercise?: ExerciseDTO | null;
  /** Name to start with when creating (what was typed into search). */
  initialName?: string;
  onCancel: () => void;
  onSaved: (exercise: ExerciseDTO) => void;
  cancelLabel?: string;
}

/** Create or edit a custom exercise: name, main muscle, equipment, how it is logged, steps. */
export function CustomExerciseForm({ exercise, initialName = "", onCancel, onSaved, cancelLabel = "Cancel" }: CustomExerciseFormProps) {
  const isEdit = Boolean(exercise);
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [primaryMuscle, setPrimaryMuscle] = useState<string>(
    exercise && (PRIMARY_MUSCLES as readonly string[]).includes(exercise.primaryMuscle) ? exercise.primaryMuscle : PRIMARY_MUSCLES[0]
  );
  const [equipment, setEquipment] = useState<string>(exercise?.equipment ?? "barbell");
  const [trackingType, setTrackingType] = useState<TrackingType | null>(exercise?.trackingType ?? null);
  const [steps, setSteps] = useState((exercise?.instructions ?? []).join("\n"));
  const [nameError, setNameError] = useState<string | null>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Until chosen, how the exercise is logged follows the equipment.
  const effectiveTracking: TrackingType = trackingType ?? (equipment === "bodyweight" ? "bodyweight_reps" : "weight_reps");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const trimmed = name.trim();
    const lines = steps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    let invalid = false;
    if (trimmed.length < 2) {
      setNameError("Give the exercise a name (at least 2 characters).");
      invalid = true;
    }
    if (lines.length > MAX_STEPS) {
      setStepsError(`Use at most ${MAX_STEPS} steps.`);
      invalid = true;
    } else if (lines.some((line) => line.length > MAX_STEP_LENGTH)) {
      setStepsError(`Keep each step under ${MAX_STEP_LENGTH} characters.`);
      invalid = true;
    }
    if (invalid) return;

    setIsSaving(true);
    setError(null);
    const body = { name: trimmed, primaryMuscle, equipment, trackingType: effectiveTracking, instructions: lines };
    try {
      const data = exercise
        ? await api<{ exercise: ExerciseDTO }>(`/api/exercises/${exercise.id}`, { method: "PATCH", body })
        : await api<{ exercise: ExerciseDTO }>("/api/exercises", { method: "POST", body });
      onSaved(data.exercise);
    } catch (err) {
      setError(errorMessage(err));
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Input
        label="Name"
        value={name}
        onChange={(event) => {
          setName(event.target.value.slice(0, 80));
          if (nameError) setNameError(null);
        }}
        maxLength={80}
        data-autofocus
        autoComplete="off"
        placeholder="Landmine press"
        isInvalid={Boolean(nameError)}
        errorMessage={nameError ?? undefined}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select<string> label="Main muscle" options={MUSCLE_OPTIONS} value={primaryMuscle} onChange={setPrimaryMuscle} />
        <Select<string> label="Equipment" options={EQUIPMENT_OPTIONS} value={equipment} onChange={setEquipment} />
      </div>
      <Select<TrackingType>
        label="How it is logged"
        options={TRACKING_OPTIONS}
        value={effectiveTracking}
        onChange={(value) => setTrackingType(value)}
      />
      <Textarea
        label="Steps (optional)"
        description="One step per line."
        value={steps}
        onChange={(event) => {
          setSteps(event.target.value);
          if (stepsError) setStepsError(null);
        }}
        rows={3}
        isInvalid={Boolean(stepsError)}
        errorMessage={stepsError ?? undefined}
      />
      {error && (
        <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
          {cancelLabel}
        </Button>
        <Button type="submit" isLoading={isSaving}>
          {isEdit ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}

export default CustomExerciseForm;
