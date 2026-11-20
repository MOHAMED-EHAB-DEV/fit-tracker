"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Plus, Search, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  addToExerciseCatalog,
  filterExercises,
  loadExerciseCatalog,
  recentExerciseIds,
  rememberExercises,
} from "@/lib/workouts/catalog-client";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  PRIMARY_MUSCLES,
  type Equipment,
  type MuscleGroup,
} from "@/lib/workouts/taxonomy";
import type { ExerciseDTO } from "@/lib/workouts/types";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";

const EQUIPMENT_OPTIONS: SelectOption<string>[] = EQUIPMENT.map((item) => ({ value: item, label: EQUIPMENT_LABELS[item] }));
const EQUIPMENT_FILTER_OPTIONS: SelectOption<string>[] = [{ value: "all", label: "Any" }, ...EQUIPMENT_OPTIONS];
const PRIMARY_MUSCLE_OPTIONS: SelectOption<string>[] = PRIMARY_MUSCLES.map((muscle) => ({ value: muscle, label: muscle }));

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the chosen exercises, in the order they were picked. */
  onAdd?: (exercises: ExerciseDTO[]) => void;
  /**
   * "single" closes after one pick (used to replace an exercise);
   * "browse" is the exercise library: tapping an exercise opens its details.
   */
  mode?: "multi" | "single" | "browse";
  title?: string;
}

const PAGE_SIZE = 60;
const CHIP =
  "shrink-0 px-3.5 min-h-10 rounded-full text-sm font-medium border transition-colors cursor-pointer";

export function ExercisePicker({ isOpen, onClose, onAdd, mode = "multi", title }: ExercisePickerProps) {
  const [catalog, setCatalog] = useState<ExerciseDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | "all">("all");
  const [equipment, setEquipment] = useState<string | "all">("all");
  const [selected, setSelected] = useState<ExerciseDTO[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const load = (force = false) => {
    setLoadError(null);
    loadExerciseCatalog(force)
      .then(setCatalog)
      .catch((err) => setLoadError(errorMessage(err, "The exercise list could not be loaded.")));
  };

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the picker each time it opens
    setSelected([]);
    setQuery("");
    setMuscleGroup("all");
    setEquipment("all");
    setVisibleCount(PAGE_SIZE);
    setIsCreating(false);
    setRecentIds(recentExerciseIds());
    load();
  }, [isOpen]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const filtered = filterExercises(catalog, { query, muscleGroup, equipment });
    // With no search and no filters, recently used exercises come first.
    if (!query.trim() && muscleGroup === "all" && equipment === "all" && recentIds.length > 0) {
      const byId = new Map(filtered.map((exercise) => [exercise.id, exercise]));
      const recent = recentIds.map((id) => byId.get(id)).filter((exercise): exercise is ExerciseDTO => Boolean(exercise));
      const recentSet = new Set(recent.map((exercise) => exercise.id));
      return [...recent, ...filtered.filter((exercise) => !recentSet.has(exercise.id))];
    }
    return filtered;
  }, [catalog, query, muscleGroup, equipment, recentIds]);

  const recentCount = useMemo(() => {
    if (query.trim() || muscleGroup !== "all" || equipment !== "all") return 0;
    const ids = new Set(results.map((exercise) => exercise.id));
    return recentIds.filter((id) => ids.has(id)).length;
  }, [results, recentIds, query, muscleGroup, equipment]);

  const selectedIds = useMemo(() => new Set(selected.map((exercise) => exercise.id)), [selected]);

  const resetScroll = () => {
    setVisibleCount(PAGE_SIZE);
    listRef.current?.closest("section")?.scrollTo({ top: 0 });
  };

  const confirm = (exercises: ExerciseDTO[]) => {
    if (exercises.length === 0) return;
    rememberExercises(exercises.map((exercise) => exercise.id));
    onAdd?.(exercises);
    onClose();
  };

  const toggle = (exercise: ExerciseDTO) => {
    if (mode === "browse") {
      setDetailId(exercise.id);
      return;
    }
    if (mode === "single") {
      confirm([exercise]);
      return;
    }
    setSelected((current) =>
      current.some((item) => item.id === exercise.id)
        ? current.filter((item) => item.id !== exercise.id)
        : [...current, exercise]
    );
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={title || (mode === "browse" ? "Exercise library" : mode === "single" ? "Choose an exercise" : "Add exercises")}
        position="bottom"
        className="h-[92%]"
        footer={
          mode === "multi" && !isCreating ? (
            <Button
              className="w-full"
              size="lg"
              disabled={selected.length === 0}
              onClick={() => confirm(selected)}
            >
              {selected.length === 0
                ? "Select exercises"
                : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
            </Button>
          ) : undefined
        }
      >
        {isCreating ? (
          <CustomExerciseForm
            initialName={query.trim()}
            onCancel={() => setIsCreating(false)}
            onCreated={(exercise) => {
              addToExerciseCatalog(exercise);
              setCatalog((current) => (current ? [...current, exercise] : [exercise]));
              setIsCreating(false);
              if (mode === "browse") setQuery(exercise.name);
              else if (mode === "single") confirm([exercise]);
              else {
                setSelected((current) => [...current, exercise]);
                setQuery("");
              }
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="sticky -top-5 sm:-top-6 z-10 -mt-5 sm:-mt-6 pt-5 sm:pt-6 pb-2 bg-zinc-900 flex flex-col gap-3">
            <Input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetScroll();
              }}
              placeholder="Search exercises"
              aria-label="Search exercises"
              autoComplete="off"
              enterKeyHint="search"
              startContent={<Search className="w-5 h-5" />}
              endContent={
                query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      resetScroll();
                    }}
                    aria-label="Clear search"
                    className="grid place-items-center w-10 h-10 rounded-full text-zinc-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                ) : undefined
              }
            />

            <div role="group" aria-label="Muscle group" className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              {(["all", ...MUSCLE_GROUPS.filter((group) => group !== "other")] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  aria-pressed={muscleGroup === group}
                  onClick={() => {
                    setMuscleGroup(group);
                    resetScroll();
                  }}
                  className={cn(
                    CHIP,
                    muscleGroup === group
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950"
                      : "bg-transparent border-line text-zinc-300"
                  )}
                >
                  {group === "all" ? "All" : MUSCLE_GROUP_LABELS[group]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="shrink-0">Equipment</span>
              <Select<string>
                ariaLabel="Equipment"
                options={EQUIPMENT_FILTER_OPTIONS}
                value={equipment}
                onChange={(value) => {
                  setEquipment(value);
                  resetScroll();
                }}
                size="sm"
                className="flex-1 min-w-0"
              />
            </div>
            </div>

            <div ref={listRef} className="-mx-2">
              {loadError ? (
                <div className="px-2 py-10 text-center space-y-3">
                  <p role="alert" className="text-sm text-red-300">
                    {loadError}
                  </p>
                  <Button variant="bordered" onClick={() => load(true)}>
                    Try again
                  </Button>
                </div>
              ) : !catalog ? (
                <div className="px-2 space-y-2" aria-busy="true" aria-label="Loading exercises">
                  {Array.from({ length: 8 }, (_, index) => (
                    <div key={index} className="skeleton h-14" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="px-2 py-10 text-center space-y-3">
                  <p className="text-sm text-zinc-300">
                    {query.trim() ? `No exercise matches "${query.trim()}".` : "No exercises match these filters."}
                  </p>
                  <Button variant="flat" startContent={<Plus className="w-4 h-4" />} onClick={() => setIsCreating(true)}>
                    Create a custom exercise
                  </Button>
                </div>
              ) : (
                <ul>
                  {results.slice(0, visibleCount).map((exercise, index) => {
                    const isSelected = selectedIds.has(exercise.id);
                    return (
                      <li key={exercise.id}>
                        {index === 0 && recentCount > 0 && (
                          <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Recently used
                          </p>
                        )}
                        {index === recentCount && recentCount > 0 && (
                          <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            All exercises
                          </p>
                        )}
                        <div className="flex items-center">
                          <button
                            type="button"
                            aria-pressed={mode === "multi" ? isSelected : undefined}
                            onClick={() => toggle(exercise)}
                            className={cn(
                              "flex flex-1 min-w-0 items-center gap-3 px-3 min-h-14 rounded-xl text-start cursor-pointer",
                              isSelected ? "bg-emerald-500/15" : "active:bg-white/5"
                            )}
                          >
                            {mode === "multi" && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "grid place-items-center w-6 h-6 rounded-md border shrink-0",
                                  isSelected ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "border-zinc-500"
                                )}
                              >
                                {isSelected && <Check className="w-4 h-4" />}
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block text-base font-medium text-white truncate">{exercise.name}</span>
                              <span className="block text-sm text-zinc-400 truncate">
                                {exercise.primaryMuscle} ·{" "}
                                {EQUIPMENT_LABELS[exercise.equipment as Equipment] || exercise.equipment}
                                {exercise.isCustom ? " · Custom" : ""}
                              </span>
                            </span>
                          </button>
                          {mode !== "browse" && (
                            <button
                              type="button"
                              onClick={() => setDetailId(exercise.id)}
                              aria-label={`How to do ${exercise.name}`}
                              className="grid place-items-center w-11 h-11 rounded-full text-zinc-400 active:bg-white/10 shrink-0 cursor-pointer"
                            >
                              <Info className="w-5 h-5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {results.length > visibleCount && (
                    <li className="px-2 py-3">
                      <Button variant="bordered" className="w-full" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                        Show more ({results.length - visibleCount} left)
                      </Button>
                    </li>
                  )}
                  <li className="px-2 py-3">
                    <Button variant="ghost" className="w-full" startContent={<Plus className="w-4 h-4" />} onClick={() => setIsCreating(true)}>
                      Create a custom exercise
                    </Button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ExerciseDetailSheet exerciseId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

function CustomExerciseForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (exercise: ExerciseDTO) => void;
}) {
  const [name, setName] = useState(initialName);
  const [primaryMuscle, setPrimaryMuscle] = useState<string>(PRIMARY_MUSCLES[0]);
  const [equipment, setEquipment] = useState<string>("barbell");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    if (name.trim().length < 2) {
      setError("Give the exercise a name.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const data = await api<{ exercise: ExerciseDTO }>("/api/exercises", {
        method: "POST",
        body: { name: name.trim(), primaryMuscle, equipment },
      });
      onCreated(data.exercise);
    } catch (err) {
      setError(errorMessage(err));
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h3 className="text-base font-semibold text-white">New custom exercise</h3>
      <Input
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
        data-autofocus
        placeholder="e.g. Landmine press"
      />
      <Select<string>
        label="Main muscle"
        options={PRIMARY_MUSCLE_OPTIONS}
        value={primaryMuscle}
        onChange={(value) => setPrimaryMuscle(value)}
      />
      <Select<string>
        label="Equipment"
        options={EQUIPMENT_OPTIONS}
        value={equipment}
        onChange={(value) => setEquipment(value)}
      />
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="bordered" className="flex-1" onClick={onCancel} disabled={isSaving}>
          Back
        </Button>
        <Button type="submit" className="flex-1" isLoading={isSaving}>
          Create
        </Button>
      </div>
    </form>
  );
}

export default ExercisePicker;
