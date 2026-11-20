"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, ArchiveRestore, Save, Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  ExerciseImageUploader,
  discardUpload,
  newImageId,
  type ExerciseImageItem,
} from "@/components/admin/ExerciseImageUploader";
import { ApiError, apiRequest, errorMessage } from "@/components/admin/api";
import { useUnsavedChanges } from "@/components/admin/useUnsavedChanges";
import { usageSummary } from "@/components/admin/exerciseUsage";
import {
  CATEGORY_OPTIONS,
  EQUIPMENT_SELECT_OPTIONS,
  FORCE_OPTIONS,
  LEVEL_OPTIONS,
  MECHANIC_OPTIONS,
  MUSCLES,
  MUSCLE_OPTIONS,
  TRACKING_TYPE_LABELS,
  TRACKING_TYPE_OPTIONS,
} from "@/constants/exercise";
import {
  EXERCISE_LIMITS as L,
  canonicalCategory,
  canonicalEquipment,
  canonicalPrimaryMuscle,
  cleanSecondaryMuscles,
} from "@/lib/admin/exercise-vocabulary";
import { normalizeExerciseName, trackingTypeOf, type TrackingType } from "@/lib/workouts/taxonomy";
import type { AdminExerciseDTO, ExerciseUsage } from "@/lib/admin/exercises";

// ── Form model ──────────────────────────────────────────────────────────────

interface Step {
  key: string;
  text: string;
}

interface FormState {
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  trackingType: TrackingType | "auto";
  force: string;
  level: string;
  mechanic: string;
  metValue: string;
  instructions: Step[];
}

type FieldErrors = Partial<Record<"name" | "primaryMuscle" | "equipment" | "category" | "metValue" | "instructions", string>>;

let stepCounter = 0;
const newStep = (text = ""): Step => ({ key: `step-${++stepCounter}`, text });

function toForm(exercise?: AdminExerciseDTO | null): FormState {
  if (!exercise) {
    return {
      name: "",
      primaryMuscle: "",
      secondaryMuscles: [],
      equipment: "",
      category: "strength",
      trackingType: "auto",
      force: "",
      level: "",
      mechanic: "",
      metValue: "",
      instructions: [newStep()],
    };
  }
  // Older or imported records may use other spellings; map them onto the list when possible.
  const primary = canonicalPrimaryMuscle(exercise.primaryMuscle) ?? exercise.primaryMuscle;
  return {
    name: exercise.name,
    primaryMuscle: primary,
    secondaryMuscles: cleanSecondaryMuscles(exercise.secondaryMuscles, canonicalPrimaryMuscle(primary)),
    equipment: canonicalEquipment(exercise.equipment) ?? exercise.equipment,
    category: canonicalCategory(exercise.category) ?? exercise.category,
    trackingType: exercise.trackingTypeChoice,
    force: exercise.force || "",
    level: exercise.level || "",
    mechanic: exercise.mechanic || "",
    metValue: String(exercise.metValue),
    instructions: exercise.instructions.length ? exercise.instructions.map((text) => newStep(text)) : [newStep()],
  };
}

function toImages(urls: string[]): ExerciseImageItem[] {
  return urls.map((url) => ({ id: newImageId("saved"), url, previewUrl: url, status: "ready" }));
}

const snapshot = (form: FormState, images: ExerciseImageItem[]) =>
  JSON.stringify({
    ...form,
    instructions: form.instructions.map((step) => step.text.trim()).filter(Boolean),
    images: images.map((item) => item.url || item.id),
  });

function validate(form: FormState, images: ExerciseImageItem[]) {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  if (name.length < L.nameMin) errors.name = `Enter a name (at least ${L.nameMin} characters)`;
  else if (name.length > L.nameMax) errors.name = `At most ${L.nameMax} characters`;
  else if (!normalizeExerciseName(name)) errors.name = "Use Latin letters or numbers in the name";

  const primary = canonicalPrimaryMuscle(form.primaryMuscle);
  if (!primary) errors.primaryMuscle = form.primaryMuscle ? "This muscle is not in the list. Choose one." : "Choose the main muscle";
  const equipment = canonicalEquipment(form.equipment);
  if (!equipment) errors.equipment = form.equipment ? "Not in the list. Choose one." : "Choose the equipment";
  const category = canonicalCategory(form.category);
  if (!category) errors.category = "Choose a category";

  const met = Number(form.metValue);
  if (form.metValue.trim() === "" || !Number.isFinite(met) || met < L.metMin || met > L.metMax) {
    errors.metValue = `Enter a MET value from ${L.metMin} to ${L.metMax} (e.g. 3.5)`;
  }

  const steps = form.instructions.map((step) => step.text.trim()).filter(Boolean);
  if (steps.length > L.maxInstructions) errors.instructions = `At most ${L.maxInstructions} steps`;
  if (steps.some((step) => step.length > L.instructionMax)) errors.instructions = `Each step can have at most ${L.instructionMax} characters`;

  let blocking: string | null = null;
  if (images.some((item) => item.status === "uploading")) blocking = "Wait until the images finish uploading.";
  else if (images.some((item) => item.status === "error")) blocking = "Some images failed to upload. Retry or remove them first.";

  const body = {
    name,
    primaryMuscle: form.primaryMuscle,
    secondaryMuscles: form.secondaryMuscles,
    equipment: form.equipment,
    category: form.category,
    trackingType: form.trackingType,
    force: form.force || null,
    level: form.level || null,
    mechanic: form.mechanic || null,
    metValue: Math.round(met * 10) / 10,
    instructions: steps,
    images: images.map((item) => item.url).filter((url): url is string => Boolean(url)),
  };
  return { errors, blocking, body };
}

const withLegacy = (options: { value: string; label: string }[], value: string) =>
  value && !options.some((option) => option.value === value)
    ? [{ value, label: `${value} (old value, choose another)` }, ...options]
    : options;

// ── Component ───────────────────────────────────────────────────────────────

export interface ExerciseFormProps {
  mode: "create" | "edit";
  initialExercise?: AdminExerciseDTO | null;
}

export function ExerciseForm({ mode, initialExercise = null }: ExerciseFormProps) {
  const isEdit = mode === "edit" && Boolean(initialExercise);
  const router = useRouter();
  const { toast } = useToast();

  const [exercise, setExercise] = useState(initialExercise);
  const [form, setForm] = useState(() => toForm(initialExercise));
  const [images, setImages] = useState<ExerciseImageItem[]>(() => toImages(initialExercise?.images || []));
  const [baseline, setBaseline] = useState(() => snapshot(toForm(initialExercise), toImages(initialExercise?.images || [])));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ message: string; existingId?: string; stale?: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const savingRef = useRef(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [usage, setUsage] = useState<ExerciseUsage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const dirty = !navigating && snapshot(form, images) !== baseline;
  useUnsavedChanges(dirty);

  // Uploads that never made it into a saved exercise are discarded when the editor closes.
  const unsavedUploads = useRef<string[]>([]);
  useEffect(() => {
    unsavedUploads.current = images.filter((item) => item.unsaved && item.url).map((item) => item.url!);
  }, [images]);
  useEffect(() => {
    const discardAll = (keepalive: boolean) => {
      unsavedUploads.current.forEach((url) => discardUpload(url, keepalive));
      unsavedUploads.current = [];
    };
    const onPageHide = () => discardAll(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      discardAll(true);
    };
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const derivedTracking = trackingTypeOf({ name: form.name, equipment: form.equipment, category: form.category });
  const primaryCanonical = canonicalPrimaryMuscle(form.primaryMuscle);

  const handleSave = async () => {
    if (savingRef.current || navigating) return;
    const { errors: found, blocking, body } = validate(form, images);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).some((key) => found[key as keyof FieldErrors])) {
      setFormError({ message: "Some fields need attention. They are marked below." });
      return;
    }
    if (blocking) {
      setFormError({ message: blocking });
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      if (isEdit && exercise) {
        const data = await apiRequest<{ exercise: AdminExerciseDTO; imageCleanupFailures: number }>(
          `/api/admin/exercises/${exercise.id}`,
          { method: "PATCH", body: { exercise: body, expectedUpdatedAt: exercise.updatedAt } }
        );
        const nextForm = toForm(data.exercise);
        const nextImages = images.map((item) => ({ ...item, unsaved: false }));
        unsavedUploads.current = [];
        setExercise(data.exercise);
        setForm(nextForm);
        setImages(nextImages);
        setBaseline(snapshot(nextForm, nextImages));
        toast("Exercise saved", "success");
        if (data.imageCleanupFailures > 0) {
          toast(`${data.imageCleanupFailures} removed image(s) could not be deleted from storage.`, "warning");
        }
      } else {
        const data = await apiRequest<{ exercise: AdminExerciseDTO }>("/api/admin/exercises", { method: "POST", body });
        unsavedUploads.current = [];
        setImages((current) => current.map((item) => ({ ...item, unsaved: false })));
        toast(`"${data.exercise.name}" was added to the catalog`, "success");
        // Stay locked while navigating so a second click cannot create a copy.
        setNavigating(true);
        router.replace(`/admin/exercises/${data.exercise.id}`);
        return;
      }
    } catch (err) {
      const existingId =
        err instanceof ApiError && err.status === 409 && typeof err.details?.exerciseId === "string"
          ? err.details.exerciseId
          : undefined;
      const stale = err instanceof ApiError && err.status === 409 && err.details?.reason === "stale";
      setFormError({ message: errorMessage(err), existingId, stale });
    }
    savingRef.current = false;
    setIsSaving(false);
  };

  const openArchive = async () => {
    if (!exercise) return;
    setArchiveError(null);
    setUsage(null);
    setUsageError(null);
    setArchiveOpen(true);
    if (exercise.archivedAt) return;
    try {
      const data = await apiRequest<{ usage: ExerciseUsage }>(`/api/admin/exercises/${exercise.id}/usage`);
      setUsage(data.usage);
    } catch (err) {
      setUsageError(errorMessage(err));
    }
  };

  const runArchive = async () => {
    if (!exercise || archiveBusy) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      const restoring = Boolean(exercise.archivedAt);
      const data = restoring
        ? await apiRequest<{ exercise: AdminExerciseDTO }>(`/api/admin/exercises/${exercise.id}/restore`, { method: "POST" })
        : await apiRequest<{ exercise: AdminExerciseDTO }>(`/api/admin/exercises/${exercise.id}`, { method: "DELETE" });
      // Only the archive state and version change; unsaved edits in the form stay.
      setExercise(data.exercise);
      setArchiveOpen(false);
      toast(restoring ? "Exercise restored to the picker" : "Exercise archived. Routines and history keep it.", "success");
    } catch (err) {
      setArchiveError(errorMessage(err));
    } finally {
      setArchiveBusy(false);
    }
  };

  const toggleSecondary = (muscle: string) => {
    setForm((current) => ({
      ...current,
      secondaryMuscles: current.secondaryMuscles.includes(muscle)
        ? current.secondaryMuscles.filter((m) => m !== muscle)
        : current.secondaryMuscles.length >= L.maxSecondaryMuscles
          ? current.secondaryMuscles
          : [...current.secondaryMuscles, muscle],
    }));
  };

  const setStep = (key: string, text: string) =>
    setForm((current) => ({
      ...current,
      instructions: current.instructions.map((step) => (step.key === key ? { ...step, text } : step)),
    }));
  const moveStep = (index: number, delta: -1 | 1) =>
    setForm((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.instructions.length) return current;
      const next = [...current.instructions];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...current, instructions: next };
    });

  const filledSteps = form.instructions.filter((step) => step.text.trim()).length;
  const readyImages = images.filter((item) => item.status === "ready").length;
  const completenessWarnings = [
    readyImages === 0 ? "no images" : null,
    filledSteps === 0 ? "no instruction steps" : null,
  ].filter(Boolean);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      className="space-y-6 max-w-3xl"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/exercises"
          aria-label="Back to exercises"
          className="min-h-11 min-w-11 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-48">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{isEdit ? "Edit exercise" : "Add exercise"}</h1>
          <p className="text-xs text-zinc-400">
            {isEdit
              ? exercise?.isCustom
                ? "A user's custom exercise"
                : "Catalog exercise"
              : "Adds an exercise to the catalog every user can pick from"}
          </p>
        </div>
        {isEdit && exercise && (
          <Button
            type="button"
            variant="bordered"
            size="md"
            onClick={() => void openArchive()}
            startContent={
              exercise.archivedAt ? <ArchiveRestore className="w-4 h-4" aria-hidden="true" /> : <Archive className="w-4 h-4" aria-hidden="true" />
            }
            className="min-h-11"
          >
            {exercise.archivedAt ? "Restore" : "Archive"}
          </Button>
        )}
      </div>

      {exercise?.archivedAt && (
        <p className="flex items-start gap-2 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          This exercise is archived: users cannot add it, but their routines and history keep it. Restore it to make it available again.
        </p>
      )}

      {formError && (
        <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm font-medium text-red-300 space-y-2">
          <p>{formError.message}</p>
          <div className="flex flex-wrap gap-2">
            {formError.existingId && (
              <Link href={`/admin/exercises/${formError.existingId}`} className="inline-flex items-center min-h-11 px-3 rounded-lg bg-zinc-900 text-violet-300 underline">
                Open the existing exercise
              </Link>
            )}
            {formError.stale && (
              <Button type="button" variant="bordered" size="sm" onClick={() => window.location.reload()} className="min-h-11">
                Reload latest version
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Basics</h2>

        <Input
          label="Name *"
          placeholder="e.g. Incline Dumbbell Press"
          value={form.name}
          maxLength={L.nameMax}
          onChange={(e) => update("name", e.target.value)}
          isInvalid={Boolean(errors.name)}
          errorMessage={errors.name}
          description="Names must be unique, ignoring case and punctuation."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Primary muscle *"
            searchable
            options={withLegacy(MUSCLE_OPTIONS, form.primaryMuscle)}
            value={form.primaryMuscle}
            onChange={(value) => {
              update("primaryMuscle", value || "");
              // A muscle cannot be both primary and secondary.
              setForm((current) => ({ ...current, secondaryMuscles: current.secondaryMuscles.filter((m) => m !== value) }));
            }}
            error={errors.primaryMuscle}
          />
          <Select
            label="Equipment *"
            searchable
            options={withLegacy(EQUIPMENT_SELECT_OPTIONS, form.equipment)}
            value={form.equipment}
            onChange={(value) => update("equipment", value || "")}
            error={errors.equipment}
          />
          <Select
            label="Category *"
            options={withLegacy(CATEGORY_OPTIONS, form.category)}
            value={form.category}
            onChange={(value) => update("category", value || "")}
            error={errors.category}
          />
          <Select<string>
            label="Logged as"
            options={[
              { value: "auto", label: `Automatic: ${TRACKING_TYPE_LABELS[derivedTracking]}` },
              ...TRACKING_TYPE_OPTIONS,
            ]}
            value={form.trackingType}
            onChange={(value) => update("trackingType", (value || "auto") as TrackingType | "auto")}
          />
          <Input
            label="MET value *"
            type="number"
            inputMode="decimal"
            min={L.metMin}
            max={L.metMax}
            step={0.1}
            placeholder="e.g. 5.0"
            value={form.metValue}
            onChange={(e) => update("metValue", e.target.value)}
            isInvalid={Boolean(errors.metValue)}
            errorMessage={errors.metValue}
            description="Energy cost used for calories: ~3 light, ~5 moderate lifting, 8+ vigorous."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Force"
            options={[{ value: "", label: "Not set" }, ...FORCE_OPTIONS]}
            value={form.force}
            onChange={(value) => update("force", value || "")}
          />
          <Select
            label="Level"
            options={[{ value: "", label: "Not set" }, ...LEVEL_OPTIONS]}
            value={form.level}
            onChange={(value) => update("level", value || "")}
          />
          <Select
            label="Mechanic"
            options={[{ value: "", label: "Not set" }, ...MECHANIC_OPTIONS]}
            value={form.mechanic}
            onChange={(value) => update("mechanic", value || "")}
          />
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 id="secondary-heading" className="text-sm font-extrabold text-white uppercase tracking-wider">
          Secondary muscles
        </h2>
        <p className="text-sm text-zinc-400">Other muscles that work (up to {L.maxSecondaryMuscles}). The primary muscle is excluded.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="secondary-heading">
          {MUSCLES.map((muscle) => {
            const selected = form.secondaryMuscles.includes(muscle);
            const isPrimary = primaryCanonical === muscle;
            return (
              <button
                key={muscle}
                type="button"
                aria-pressed={selected}
                disabled={isPrimary}
                onClick={() => toggleSecondary(muscle)}
                className={`min-h-11 px-3 rounded-full text-sm font-semibold border transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  selected ? "bg-violet-600 border-violet-500 text-white" : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {muscle}
                {isPrimary && " (primary)"}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Instructions</h2>
          <Button
            type="button"
            variant="flat"
            size="sm"
            disabled={form.instructions.length >= L.maxInstructions}
            onClick={() => setForm((current) => ({ ...current, instructions: [...current.instructions, newStep()] }))}
            startContent={<Plus className="w-4 h-4" aria-hidden="true" />}
            className="min-h-11"
          >
            Add step
          </Button>
        </div>
        {errors.instructions && <p className="text-sm text-red-300">{errors.instructions}</p>}
        <ol className="space-y-3">
          {form.instructions.map((step, index) => (
            <li key={step.key} className="flex items-start gap-2">
              <span className="w-8 h-8 mt-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                {index + 1}
              </span>
              <label htmlFor={step.key} className="sr-only">
                Step {index + 1}
              </label>
              <textarea
                id={step.key}
                rows={2}
                maxLength={L.instructionMax}
                value={step.text}
                placeholder={`Step ${index + 1}…`}
                onChange={(e) => setStep(step.key, e.target.value)}
                className="flex-1 min-w-0 bg-zinc-950/60 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-y placeholder:text-zinc-400"
              />
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move step ${index + 1} up`}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ChevronUp className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === form.instructions.length - 1}
                  aria-label={`Move step ${index + 1} down`}
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                aria-label={`Remove step ${index + 1}`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    instructions:
                      current.instructions.length > 1 ? current.instructions.filter((s) => s.key !== step.key) : [newStep()],
                  }))
                }
                className="mt-1 min-h-11 min-w-11 flex items-center justify-center rounded-xl text-zinc-300 hover:text-red-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Images</h2>
        <ExerciseImageUploader images={images} setImages={setImages} />
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pb-8">
        {completenessWarnings.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-amber-200 sm:mr-auto">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            Users will see {completenessWarnings.join(" and ")} for this exercise.
          </p>
        )}
        <Link
          href="/admin/exercises"
          className="inline-flex items-center justify-center px-4 min-h-11 text-sm text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Cancel
        </Link>
        <Button
          type="submit"
          variant="solid"
          size="md"
          isLoading={isSaving}
          disabled={isSaving || navigating || (isEdit && !dirty)}
          startContent={<Save className="w-4 h-4" aria-hidden="true" />}
          className="min-h-11"
        >
          {isSaving || navigating ? "Saving…" : isEdit ? "Save changes" : "Create exercise"}
        </Button>
      </div>

      {isEdit && exercise && (
        <ConfirmModal
          isOpen={archiveOpen}
          onClose={() => {
            if (!archiveBusy) setArchiveOpen(false);
          }}
          onConfirm={runArchive}
          title={exercise.archivedAt ? "Restore exercise" : "Archive exercise"}
          message={
            exercise.archivedAt
              ? `Make "${exercise.name}" available in the exercise picker again?`
              : `Archive "${exercise.name}"? It disappears from the exercise picker. Routines that contain it and logged workouts keep it, and you can restore it at any time.`
          }
          confirmLabel={exercise.archivedAt ? "Restore" : "Archive"}
          confirmVariant={exercise.archivedAt ? "primary" : "warning"}
          isLoading={archiveBusy}
          error={archiveError}
        >
          {!exercise.archivedAt && (
            <p className="text-sm text-zinc-300" aria-live="polite">
              {usageError ? `Usage could not be checked: ${usageError}` : usage ? usageSummary(usage) : "Checking where it is used…"}
            </p>
          )}
        </ConfirmModal>
      )}
    </form>
  );
}

export default ExerciseForm;
