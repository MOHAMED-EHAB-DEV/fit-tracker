"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip, FilterChip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { CustomExerciseForm } from "@/components/workout/CustomExerciseForm";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import {
  addToExerciseCatalog,
  filterExercises,
  loadExerciseCatalog,
  recentExerciseIds,
  rememberExercises,
} from "@/lib/workouts/catalog-client";
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type Equipment, type MuscleGroup } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO } from "@/lib/workouts/types";

const EQUIPMENT_FILTER_OPTIONS: SelectOption<string>[] = [
  { value: "all", label: "Any equipment" },
  ...EQUIPMENT.map((item) => ({ value: item, label: EQUIPMENT_LABELS[item] })),
];

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the chosen exercises, in the order they were picked. */
  onAdd?: (exercises: ExerciseDTO[]) => void;
  /** "single" closes after one pick (used to replace an exercise). */
  mode?: "multi" | "single";
  title?: string;
}

const PAGE_SIZE = 60;

/** Choose exercises to add to a workout or routine (or one to replace an exercise with). */
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
    if (mode === "single") {
      confirm([exercise]);
      return;
    }
    setSelected((current) =>
      current.some((item) => item.id === exercise.id) ? current.filter((item) => item.id !== exercise.id) : [...current, exercise]
    );
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title={isCreating ? "New custom exercise" : title || (mode === "single" ? "Choose an exercise" : "Add exercises")}
        size="lg"
        className="h-[92dvh] md:h-[min(760px,90dvh)]"
        footer={
          mode === "multi" && !isCreating ? (
            <Button fullWidth size="lg" disabled={selected.length === 0} onClick={() => confirm(selected)}>
              {selected.length === 0 ? "Select exercises" : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
            </Button>
          ) : undefined
        }
      >
        {isCreating ? (
          <CustomExerciseForm
            initialName={query.trim()}
            cancelLabel="Back"
            onCancel={() => setIsCreating(false)}
            onSaved={(exercise) => {
              addToExerciseCatalog(exercise);
              setCatalog((current) => (current ? [...current, exercise] : [exercise]));
              setIsCreating(false);
              if (mode === "single") confirm([exercise]);
              else {
                setSelected((current) => [...current, exercise]);
                setQuery("");
              }
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2.5 border-b border-line bg-(--glass-fallback-sheet) px-4 pb-3 md:-mx-6 md:px-6">
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
                startContent={<Search className="h-4 w-4" />}
                endContent={
                  query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        resetScroll();
                      }}
                      aria-label="Clear search"
                      className="grid h-9 w-9 place-items-center rounded-chip text-ink-3 hover:text-ink cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />

              <div role="group" aria-label="Muscle group" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:-mx-6 md:px-6">
                {(["all", ...MUSCLE_GROUPS.filter((group) => group !== "other")] as const).map((group) => (
                  <FilterChip
                    key={group}
                    selected={muscleGroup === group}
                    onClick={() => {
                      setMuscleGroup(group);
                      resetScroll();
                    }}
                  >
                    {group === "all" ? "All" : MUSCLE_GROUP_LABELS[group]}
                  </FilterChip>
                ))}
              </div>

              <Select<string>
                ariaLabel="Equipment"
                options={EQUIPMENT_FILTER_OPTIONS}
                value={equipment}
                onChange={(value) => {
                  setEquipment(value);
                  resetScroll();
                }}
                size="sm"
              />
            </div>

            <div ref={listRef}>
              {loadError ? (
                <div className="space-y-3 py-10 text-center">
                  <p role="alert" className="text-sm text-danger">
                    {loadError}
                  </p>
                  <Button variant="secondary" onClick={() => load(true)}>
                    Try again
                  </Button>
                </div>
              ) : !catalog ? (
                <div className="space-y-2" aria-busy="true" aria-label="Loading exercises">
                  {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} className="h-12 rounded-control" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="space-y-3 py-10 text-center">
                  <p className="text-sm text-ink-2">
                    {query.trim() ? `No exercise matches “${query.trim()}”.` : "No exercises match these filters."}
                  </p>
                  <Button variant="secondary" startContent={<Plus className="h-4 w-4" />} onClick={() => setIsCreating(true)}>
                    New custom exercise
                  </Button>
                </div>
              ) : (
                <ul className="-mx-2">
                  {results.slice(0, visibleCount).map((exercise, index) => {
                    const isSelected = selectedIds.has(exercise.id);
                    return (
                      <li key={exercise.id}>
                        {index === 0 && recentCount > 0 && <p className="px-2 pb-1 text-xs font-medium text-ink-3">Recently used</p>}
                        {index === recentCount && recentCount > 0 && (
                          <p className="px-2 pb-1 pt-3 text-xs font-medium text-ink-3">All exercises</p>
                        )}
                        <div className="flex items-center">
                          <button
                            type="button"
                            aria-pressed={mode === "multi" ? isSelected : undefined}
                            onClick={() => toggle(exercise)}
                            className={cn(
                              "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-1.5 text-start transition-colors cursor-pointer",
                              isSelected ? "bg-surface" : "hover:bg-surface/60"
                            )}
                          >
                            {mode === "multi" && (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border",
                                  isSelected ? "border-ink bg-ink text-ink-inverse" : "border-line-strong"
                                )}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{exercise.name}</span>
                              <span className="mt-0.5 block truncate text-xs text-ink-3">
                                <span className="capitalize">{exercise.primaryMuscle}</span> ·{" "}
                                {EQUIPMENT_LABELS[exercise.equipment as Equipment] || exercise.equipment}
                              </span>
                            </span>
                            {exercise.isCustom && <Chip size="sm">Custom</Chip>}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailId(exercise.id)}
                            aria-label={`About ${exercise.name}`}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-surface hover:text-ink cursor-pointer"
                          >
                            <Info className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {results.length > visibleCount && (
                    <li className="px-2 py-3">
                      <Button variant="secondary" fullWidth onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                        Show more ({results.length - visibleCount} left)
                      </Button>
                    </li>
                  )}
                  <li className="px-2 py-3">
                    <Button variant="ghost" fullWidth startContent={<Plus className="h-4 w-4" />} onClick={() => setIsCreating(true)}>
                      New custom exercise
                    </Button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        )}
      </Sheet>

      <ExerciseDetailSheet exerciseId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

export default ExercisePicker;
