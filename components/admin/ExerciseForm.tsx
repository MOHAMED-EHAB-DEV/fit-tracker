"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Save, Plus, Check } from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ExerciseImageUploader, ExerciseImageItem } from "@/components/admin/ExerciseImageUploader";
import {
  MUSCLES,
  EQUIPMENT_OPTIONS,
  CATEGORIES,
  LEVELS,
  FORCES,
  MECHANICS,
  MUSCLE_OPTIONS,
  EQUIPMENT_SELECT_OPTIONS,
  CATEGORY_OPTIONS,
  FORCE_OPTIONS,
  LEVEL_OPTIONS,
  MECHANIC_OPTIONS,
} from "@/constants/exercise";

export {
  MUSCLES,
  EQUIPMENT_OPTIONS,
  CATEGORIES,
  LEVELS,
  FORCES,
  MECHANICS,
};

export interface ExerciseFormState {
  _id?: string;
  name: string;
  slug?: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  metValue: string | number;
  instructions: string[];
  images: string[];
  isCustom?: boolean;
}

export interface ExerciseFormProps {
  exerciseId?: string;
  initialData?: Partial<ExerciseFormState>;
  mode?: "create" | "edit";
  onSuccess?: (exercise: any) => void;
}

const DEFAULT_FORM: ExerciseFormState = {
  name: "",
  primaryMuscle: "",
  secondaryMuscles: [],
  equipment: "other",
  category: "strength",
  force: "",
  level: "",
  mechanic: "",
  metValue: "5.0",
  instructions: [""],
  images: [],
};

export function ExerciseForm({
  exerciseId,
  initialData,
  mode = exerciseId ? "edit" : "create",
  onSuccess,
}: ExerciseFormProps) {
  const isEdit = mode === "edit" || !!exerciseId;
  const router = useRouter();

  const [form, setForm] = useState<ExerciseFormState>(() => ({
    ...DEFAULT_FORM,
    ...initialData,
    instructions:
      initialData?.instructions && initialData.instructions.length > 0
        ? initialData.instructions
        : [""],
    images: initialData?.images || [],
  }));

  const [imageItems, setImageItems] = useState<ExerciseImageItem[]>(() => {
    const initialImages: string[] = initialData?.images || [];
    return initialImages.map((url, idx) => ({
      id: `img-${idx}-${url}`,
      url,
      previewUrl: url,
    }));
  });

  const [isLoading, setIsLoading] = useState(isEdit && !initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, isLoading: false });

  useEffect(() => {
    if (!isEdit || !exerciseId || initialData) return;

    let isMounted = true;
    setIsLoading(true);
    setError("");

    fetch(`/api/admin/exercises/${exerciseId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!isMounted) return;
        if (d.success && d.exercise) {
          setForm({
            ...d.exercise,
            instructions:
              d.exercise.instructions && d.exercise.instructions.length > 0
                ? d.exercise.instructions
                : [""],
            images: d.exercise.images || [],
          });
          setImageItems(
            (d.exercise.images || []).map((url: string, idx: number) => ({
              id: `img-${idx}-${url}`,
              url,
              previewUrl: url,
            }))
          );
        } else {
          setError(d.error || "Exercise not found");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Failed to load exercise");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isEdit, exerciseId, initialData]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!form.name.trim() || !form.primaryMuscle || !form.equipment || !form.category) {
      setError("Name, primary muscle, equipment, and category are required.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSavedSuccess(false);

    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("primaryMuscle", form.primaryMuscle.trim());
      formData.append("equipment", form.equipment);
      formData.append("category", form.category);
      if (form.force) formData.append("force", form.force);
      if (form.level) formData.append("level", form.level);
      if (form.mechanic) formData.append("mechanic", form.mechanic);
      formData.append("metValue", String(parseFloat(String(form.metValue)) || 5.0));

      const filteredInstructions = form.instructions.filter((s) => s && s.trim().length > 0);
      formData.append("instructions", JSON.stringify(filteredInstructions));
      formData.append("secondaryMuscles", JSON.stringify(form.secondaryMuscles));

      let fileCounter = 0;
      const manifest: Array<{ type: "url" | "file"; url?: string; fileIndex?: number }> = [];

      for (const item of imageItems) {
        if (item.file) {
          manifest.push({ type: "file", fileIndex: fileCounter });
          formData.append("files", item.file);
          fileCounter++;
        } else if (item.url) {
          manifest.push({ type: "url", url: item.url });
        }
      }
      formData.append("imageManifest", JSON.stringify(manifest));

      const url = isEdit
        ? `/api/admin/exercises/${exerciseId || form._id}`
        : "/api/admin/exercises";

      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setSavedSuccess(true);
        if (onSuccess) {
          onSuccess(data.exercise);
        } else if (!isEdit) {
          router.push("/admin/exercises");
        } else {
          // Update local state with any server-computed fields (e.g. slug) and Cloudinary URLs
          if (data.exercise) {
            setForm((prev) => ({
              ...prev,
              ...data.exercise,
              instructions:
                data.exercise.instructions?.length > 0
                  ? data.exercise.instructions
                  : [""],
              images: data.exercise.images || [],
            }));
            setImageItems(
              (data.exercise.images || []).map((imgUrl: string, idx: number) => ({
                id: `img-${idx}-${imgUrl}`,
                url: imgUrl,
                previewUrl: imgUrl,
              }))
            );
          }
          setTimeout(() => setSavedSuccess(false), 2500);
        }
      } else {
        setError(data.error || (isEdit ? "Failed to save changes" : "Failed to create exercise"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!exerciseId && !form._id) return;
    setDeleteModal((m) => ({ ...m, isLoading: true }));
    try {
      const res = await fetch(`/api/admin/exercises/${exerciseId || form._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        router.push("/admin/exercises");
      } else {
        setError(data.error || "Failed to delete exercise");
        setDeleteModal({ open: false, isLoading: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete exercise");
      setDeleteModal({ open: false, isLoading: false });
    }
  };

  const toggleSecondaryMuscle = (muscle: string) => {
    setForm((f) => ({
      ...f,
      secondaryMuscles: f.secondaryMuscles.includes(muscle)
        ? f.secondaryMuscles.filter((m) => m !== muscle)
        : [...f.secondaryMuscles, muscle],
    }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="h-10 bg-zinc-900 rounded-2xl animate-pulse" />
        <div className="h-64 bg-zinc-900 rounded-3xl animate-pulse" />
        <div className="h-48 bg-zinc-900 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Back to exercises"
          onClick={() => router.back()}
          className="p-2 h-9 w-9 text-zinc-400 hover:text-white rounded-xl"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 min-w-50">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {isEdit ? "Edit Exercise" : "Add New Exercise"}
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            {isEdit
              ? form.slug || "Update exercise attributes & media"
              : "Add a new exercise item to the global catalog"}
          </p>
        </div>

        {isEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete exercise"
            onClick={() => setDeleteModal({ open: true, isLoading: false })}
            className="p-2 h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}

        <Button
          type="button"
          variant="solid"
          size="md"
          onClick={handleSave}
          isLoading={isSaving}
          startContent={
            savedSuccess ? (
              <Check className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )
          }
          className={
            savedSuccess
              ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/25"
              : "bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-600/25"
          }
        >
          {isSaving
            ? "Saving…"
            : savedSuccess
            ? "Saved!"
            : isEdit
            ? "Save Changes"
            : "Create Exercise"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm font-medium text-red-400">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card className="p-6 space-y-5">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
          Basic Information
        </h2>

        <Input
          label="Exercise Name *"
          placeholder="e.g. Incline Dumbbell Press"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Primary Muscle *"
            searchable
            options={MUSCLE_OPTIONS}
            value={form.primaryMuscle}
            onChange={(val) => setForm((prev) => ({ ...prev, primaryMuscle: val }))}
          />

          <Select
            label="Equipment *"
            searchable
            options={EQUIPMENT_SELECT_OPTIONS}
            value={form.equipment}
            onChange={(val) => setForm((prev) => ({ ...prev, equipment: val }))}
          />

          <Select
            label="Category *"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(val) => setForm((prev) => ({ ...prev, category: val }))}
          />

          <Input
            label="MET Value"
            type="number"
            step="0.1"
            value={form.metValue ?? 5}
            onChange={(e) => setForm((f) => ({ ...f, metValue: e.target.value }))}
          />

          <Select
            label="Force"
            placeholder="Not set"
            clearable
            options={[
              { value: "", label: "Not set" },
              ...FORCE_OPTIONS,
            ]}
            value={form.force || ""}
            onChange={(val) => setForm((prev) => ({ ...prev, force: val || null }))}
          />

          <Select
            label="Level"
            placeholder="Not set"
            clearable
            options={[
              { value: "", label: "Not set" },
              ...LEVEL_OPTIONS,
            ]}
            value={form.level || ""}
            onChange={(val) => setForm((prev) => ({ ...prev, level: val || null }))}
          />

          <Select
            label="Mechanic"
            placeholder="Not set"
            clearable
            options={[
              { value: "", label: "Not set" },
              ...MECHANIC_OPTIONS,
            ]}
            value={form.mechanic || ""}
            onChange={(val) => setForm((prev) => ({ ...prev, mechanic: val || null }))}
          />
        </div>
      </Card>

      {/* Secondary Muscles */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
          Secondary Muscles
        </h2>
        <p className="text-xs text-zinc-400">Click to toggle auxiliary muscles engaged</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {MUSCLES.map((m) => {
            const isSelected = form.secondaryMuscles.includes(m);
            return (
              <Chip
                key={m}
                variant={isSelected ? "solid" : "flat"}
                color={isSelected ? "primary" : "default"}
                onClick={() => toggleSecondaryMuscle(m)}
                className="cursor-pointer select-none transition-all active:scale-95"
              >
                {m}
              </Chip>
            );
          })}
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Instructions
          </h2>
          <Button
            type="button"
            variant="flat"
            size="sm"
            onClick={() =>
              setForm((f) => ({
                ...f,
                instructions: [...f.instructions, ""],
              }))
            }
            startContent={<Plus className="w-3.5 h-3.5" />}
          >
            Add Step
          </Button>
        </div>
        <div className="space-y-3">
          {form.instructions.map((step: string, i: number) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-7 h-7 mt-2 rounded-xl bg-zinc-800/80 border border-white/5 text-zinc-400 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <textarea
                rows={2}
                value={step}
                placeholder={`Step ${i + 1} technique description...`}
                onChange={(e) => {
                  const u = [...form.instructions];
                  u[i] = e.target.value;
                  setForm((f) => ({ ...f, instructions: u }));
                }}
                className="flex-1 bg-zinc-950/60 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none placeholder:text-zinc-500"
              />
              {form.instructions.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove step"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      instructions: f.instructions.filter((_, j) => j !== i),
                    }))
                  }
                  className="mt-2 p-2 h-8 w-8 text-zinc-500 hover:text-red-400 rounded-xl"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Exercise Media & Images */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
          Exercise Media & Images
        </h2>
        <ExerciseImageUploader
          images={imageItems}
          onChange={setImageItems}
        />
      </Card>

      {isEdit && (
        <ConfirmModal
          isOpen={deleteModal.open}
          onClose={() => setDeleteModal({ open: false, isLoading: false })}
          onConfirm={handleDelete}
          title="Delete Exercise"
          message={`Delete "${form.name}" permanently? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          isLoading={deleteModal.isLoading}
        />
      )}
    </div>
  );
}

export default ExerciseForm;
