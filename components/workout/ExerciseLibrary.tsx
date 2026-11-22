"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip, FilterChip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CustomExerciseForm } from "@/components/workout/CustomExerciseForm";
import { ExerciseDetailSheet } from "@/components/workout/ExerciseDetailSheet";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { api, errorMessage } from "@/lib/client/api";
import {
  addToExerciseCatalog,
  filterExercises,
  loadExerciseCatalog,
  removeFromExerciseCatalog,
} from "@/lib/workouts/catalog-client";
import { EQUIPMENT, EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type Equipment, type MuscleGroup } from "@/lib/workouts/taxonomy";
import type { ExerciseDTO } from "@/lib/workouts/types";

const PAGE_SIZE = 60;
const MUSCLE_FILTERS = ["all", ...MUSCLE_GROUPS.filter((group) => group !== "other")] as const;
const EQUIPMENT_FILTERS = ["all", ...EQUIPMENT.filter((item) => item !== "other")] as const;

/** Train › Exercises: the whole library, searchable, with the user's own exercises. */
export function ExerciseLibrary() {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState<ExerciseDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | "all">("all");
  const [equipment, setEquipment] = useState<Equipment | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<{ exercise: ExerciseDTO | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadExerciseCatalog()
      .then((list) => {
        if (!cancelled) setCatalog(list);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err, "The exercise list could not be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setLoadError(null);
    loadExerciseCatalog(true)
      .then(setCatalog)
      .catch((err) => setLoadError(errorMessage(err, "The exercise list could not be loaded.")));
  };

  const removal = useUndoableDelete<ExerciseDTO>({
    getId: (exercise) => exercise.id,
    commit: async (exercise) => {
      await api(`/api/exercises/${exercise.id}`, { method: "DELETE", keepalive: true });
      removeFromExerciseCatalog(exercise.id);
    },
    message: (exercise) => `"${exercise.name}" deleted`,
    onError: (_exercise, error) => toast(errorMessage(error, "The exercise could not be deleted."), "error"),
  });

  const hiddenIds = removal.hiddenIds;
  const results = useMemo(() => {
    if (!catalog) return [];
    return filterExercises(
      catalog.filter((exercise) => !hiddenIds.has(exercise.id)),
      { query, muscleGroup, equipment }
    );
  }, [catalog, query, muscleGroup, equipment, hiddenIds]);

  const customCount = useMemo(
    () => (catalog ?? []).filter((exercise) => exercise.isCustom && !hiddenIds.has(exercise.id)).length,
    [catalog, hiddenIds]
  );

  const resetPaging = () => setVisibleCount(PAGE_SIZE);

  const saved = (exercise: ExerciseDTO, wasEdit: boolean) => {
    addToExerciseCatalog(exercise);
    setCatalog((current) => {
      const list = (current ?? []).filter((item) => item.id !== exercise.id);
      return [...list, exercise];
    });
    setForm(null);
    toast(wasEdit ? "Exercise saved" : "Exercise created", "success");
    // Editing from the detail sheet: reopen it with the new details.
    setDetailId(exercise.id);
  };

  const hasFilters = query.trim() !== "" || muscleGroup !== "all" || equipment !== "all";

  return (
    <div className="space-y-3 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-3 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetPaging();
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
                  resetPaging();
                }}
                aria-label="Clear search"
                className="grid h-9 w-9 place-items-center rounded-chip text-ink-3 hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : undefined
          }
        />
        <div role="group" aria-label="Muscle group" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
          {MUSCLE_FILTERS.map((group) => (
            <FilterChip
              key={group}
              selected={muscleGroup === group}
              onClick={() => {
                setMuscleGroup(group);
                resetPaging();
              }}
            >
              {group === "all" ? "All muscles" : MUSCLE_GROUP_LABELS[group]}
            </FilterChip>
          ))}
        </div>
        <div role="group" aria-label="Equipment" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
          {EQUIPMENT_FILTERS.map((item) => (
            <FilterChip
              key={item}
              selected={equipment === item}
              onClick={() => {
                setEquipment(item);
                resetPaging();
              }}
            >
              {item === "all" ? "Any equipment" : EQUIPMENT_LABELS[item]}
            </FilterChip>
          ))}
        </div>
        <Button variant="secondary" fullWidth startContent={<Plus className="h-4 w-4" />} onClick={() => setForm({ exercise: null })} className="hidden lg:inline-flex">
          New custom exercise
        </Button>
      </div>

      <section aria-labelledby="library-title" className="space-y-2">
        <div className="flex min-h-9 items-center justify-between gap-3 px-0.5">
          <h2 id="library-title" className="text-[13px] font-semibold text-ink-2">
            {catalog ? (
              <>
                <span className="font-mono tabular-nums">{results.length}</span> {results.length === 1 ? "exercise" : "exercises"}
                {customCount > 0 && !hasFilters && (
                  <span className="font-medium text-ink-3">
                    {" "}
                    · <span className="font-mono tabular-nums">{customCount}</span> of yours
                  </span>
                )}
              </>
            ) : (
              "Exercises"
            )}
          </h2>
          <Button variant="ghost" size="sm" startContent={<Plus className="h-4 w-4" />} onClick={() => setForm({ exercise: null })} className="lg:hidden">
            New exercise
          </Button>
        </div>

        {loadError ? (
          <EmptyState
            title="The exercise list could not be loaded"
            description={loadError}
            actions={
              <Button variant="secondary" onClick={retry}>
                Try again
              </Button>
            }
          />
        ) : !catalog ? (
          <div className="space-y-px overflow-hidden rounded-card border border-line" aria-busy="true" aria-label="Loading exercises">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-none" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title={query.trim() ? `No exercise matches “${query.trim()}”` : "No exercises match these filters"}
            description="Check the spelling, clear a filter, or add it as your own exercise."
            actions={
              <Button variant="secondary" startContent={<Plus className="h-4 w-4" />} onClick={() => setForm({ exercise: null })}>
                New custom exercise
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
              {results.slice(0, visibleCount).map((exercise) => (
                <li key={exercise.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(exercise.id)}
                    aria-haspopup="dialog"
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-start transition-colors hover:bg-elevated/60 active:bg-elevated cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{exercise.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-3">
                        <span className="capitalize">{exercise.primaryMuscle}</span> ·{" "}
                        {EQUIPMENT_LABELS[exercise.equipment as Equipment] || exercise.equipment}
                      </span>
                    </span>
                    {exercise.isCustom && <Chip size="sm">Custom</Chip>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {results.length > visibleCount && (
              <Button variant="secondary" fullWidth onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                Show more ({results.length - visibleCount} left)
              </Button>
            )}
          </>
        )}
      </section>

      <ExerciseDetailSheet
        exerciseId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(exercise) => {
          setDetailId(null);
          setForm({ exercise });
        }}
        onDelete={(exercise) => {
          setDetailId(null);
          removal.remove(exercise);
        }}
      />

      <Sheet
        isOpen={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.exercise ? "Edit exercise" : "New custom exercise"}
        description={form?.exercise ? undefined : "It appears in search and the exercise picker, marked Custom."}
      >
        {form && (
          <CustomExerciseForm
            key={form.exercise?.id ?? "new"}
            exercise={form.exercise}
            initialName={form.exercise ? undefined : query.trim()}
            onCancel={() => setForm(null)}
            onSaved={(exercise) => saved(exercise, Boolean(form.exercise))}
          />
        )}
      </Sheet>
    </div>
  );
}

export default ExerciseLibrary;
