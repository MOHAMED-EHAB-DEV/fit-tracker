"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Dumbbell, Plus, Pencil, Archive, ArchiveRestore, Activity, Timer, ImageOff, ListX } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { useAdminList } from "@/components/admin/useAdminList";
import { apiRequest, errorMessage } from "@/components/admin/api";
import { usageSummary } from "@/components/admin/exerciseUsage";
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  EQUIPMENT_LABELS,
  EQUIPMENT_SELECT_OPTIONS,
  MUSCLE_GROUP_OPTIONS,
  MUSCLE_OPTIONS,
  TRACKING_TYPE_LABELS,
  TRACKING_TYPE_OPTIONS,
} from "@/constants/exercise";
import { MUSCLES_BY_GROUP, type MuscleGroup } from "@/lib/workouts/taxonomy";
import type { AdminExerciseRow, ExerciseUsage } from "@/lib/admin/exercises";
import { buttonClasses } from "@/components/ui/button-styles";

const PAGE_SIZE = 30;

const actionClass =
  "min-h-11 min-w-11 flex items-center justify-center rounded-chip text-ink-2 transition cursor-pointer";

const label = (map: Record<string, string>, value: string) => map[value] || value;

function TrackingIcon({ type }: { type: string }) {
  if (type === "duration") return <Timer className="w-4 h-4 text-ink-2" aria-hidden="true" />;
  if (type === "cardio") return <Activity className="w-4 h-4 text-ink-2" aria-hidden="true" />;
  return <Dumbbell className="w-4 h-4 text-ink-2" aria-hidden="true" />;
}

export function AdminExercisesClient() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({
    muscleGroup: "",
    muscle: "",
    equipment: "",
    category: "",
    trackingType: "",
    type: "",
    status: "active",
    completeness: "",
  });
  const setFilter = (key: keyof typeof filters) => (value: string | null) =>
    setFilters((current) => ({
      ...current,
      [key]: value || (key === "status" ? "active" : ""),
      // A specific muscle only makes sense inside the chosen group.
      ...(key === "muscleGroup" ? { muscle: "" } : {}),
    }));

  const list = useAdminList<AdminExerciseRow>(
    "/api/admin/exercises",
    "exercises",
    { search: search.trim(), sortField, sortDir, ...filters },
    PAGE_SIZE
  );

  // Archive / restore
  const [target, setTarget] = useState<{ row: AdminExerciseRow; action: "archive" | "restore" } | null>(null);
  const [usage, setUsage] = useState<ExerciseUsage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const busy = useRef(false);
  const usageRequest = useRef(0);

  const openArchive = async (row: AdminExerciseRow) => {
    setTarget({ row, action: "archive" });
    setUsage(null);
    setUsageError(null);
    setModalError(null);
    const requestId = ++usageRequest.current;
    try {
      const data = await apiRequest<{ usage: ExerciseUsage }>(`/api/admin/exercises/${row.id}/usage`);
      if (requestId === usageRequest.current) setUsage(data.usage);
    } catch (err) {
      if (requestId === usageRequest.current) setUsageError(errorMessage(err));
    }
  };

  const runAction = async () => {
    if (!target || busy.current) return;
    busy.current = true;
    setModalBusy(true);
    setModalError(null);
    try {
      if (target.action === "archive") {
        await apiRequest(`/api/admin/exercises/${target.row.id}`, { method: "DELETE" });
        toast(`"${target.row.name}" archived. Set Status to Archived to find and restore it.`, "success");
      } else {
        await apiRequest(`/api/admin/exercises/${target.row.id}/restore`, { method: "POST" });
        toast(`"${target.row.name}" is available again`, "success");
      }
      setTarget(null);
      list.reload();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      busy.current = false;
      setModalBusy(false);
    }
  };

  const muscleOptions = filters.muscleGroup
    ? MUSCLE_OPTIONS.filter((option) => MUSCLES_BY_GROUP[filters.muscleGroup as MuscleGroup]?.includes(option.value))
    : MUSCLE_OPTIONS;

  const columns: Column<AdminExerciseRow>[] = [
    {
      key: "name",
      label: "Exercise",
      sortable: true,
      render: (row) => (
        <Link
          href={`/admin/exercises/${row.id}`}
          className="flex items-center gap-3 min-h-11 rounded"
        >
          <span className="w-9 h-9 rounded-chip bg-surface border border-line flex items-center justify-center shrink-0">
            <TrackingIcon type={row.trackingType} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-ink text-sm">{row.name}</span>
              {row.isCustom && (
                <Chip size="sm" tone="accent" className="text-xs">User&apos;s custom</Chip>
              )}
              {row.archivedAt && (
                <Chip size="sm" tone="warn" className="text-xs">Archived</Chip>
              )}
            </span>
            <span className="block text-xs text-ink-2">{label(TRACKING_TYPE_LABELS, row.trackingType)}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "primaryMuscle",
      label: "Muscle",
      sortable: true,
      render: (row) => <span className="text-sm text-ink-2">{row.primaryMuscle}</span>,
    },
    {
      key: "equipment",
      label: "Equipment",
      sortable: true,
      render: (row) => <span className="text-sm text-ink-2">{label(EQUIPMENT_LABELS, row.equipment)}</span>,
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (row) => <span className="text-sm text-ink-2">{label(CATEGORY_LABELS, row.category)}</span>,
    },
    {
      key: "metValue",
      label: "MET",
      sortable: true,
      render: (row) => <span className="font-mono text-sm text-ink-2 tabular-nums">{row.metValue.toFixed(1)}</span>,
    },
    {
      key: "completeness",
      label: "Content",
      render: (row) =>
        row.imageCount > 0 && row.instructionCount > 0 ? (
          <span className="text-xs text-ink tabular-nums">
            {row.imageCount} image{row.imageCount === 1 ? "" : "s"}, {row.instructionCount} step{row.instructionCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            {row.imageCount === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-warn">
                <ImageOff className="w-3.5 h-3.5" aria-hidden="true" /> No images
              </span>
            )}
            {row.instructionCount === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-warn">
                <ListX className="w-3.5 h-3.5" aria-hidden="true" /> No steps
              </span>
            )}
          </span>
        ),
    },
  ];

  const usageText = usage ? usageSummary(usage) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink tracking-tight">Exercise catalog</h1>
          <p className="text-ink-2 text-sm mt-0.5 tabular-nums">
            {list.pagination.total.toLocaleString()} exercise{list.pagination.total === 1 ? "" : "s"} match these filters
          </p>
        </div>
        <Link
          href="/admin/exercises/new"
          className={buttonClasses({ variant: "primary", className: "gap-2 self-start sm:self-auto" })}
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add exercise
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface border border-line rounded-card p-4">
        <Select label="Muscle group" value={filters.muscleGroup} onChange={setFilter("muscleGroup")} options={[{ value: "", label: "All groups" }, ...MUSCLE_GROUP_OPTIONS]} />
        <Select label="Muscle" searchable value={filters.muscle} onChange={setFilter("muscle")} options={[{ value: "", label: "All muscles" }, ...muscleOptions]} />
        <Select label="Equipment" searchable value={filters.equipment} onChange={setFilter("equipment")} options={[{ value: "", label: "All equipment" }, ...EQUIPMENT_SELECT_OPTIONS]} />
        <Select label="Category" value={filters.category} onChange={setFilter("category")} options={[{ value: "", label: "All categories" }, ...CATEGORY_OPTIONS]} />
        <Select label="Tracked as" value={filters.trackingType} onChange={setFilter("trackingType")} options={[{ value: "", label: "Any" }, ...TRACKING_TYPE_OPTIONS]} />
        <Select
          label="Source"
          value={filters.type}
          onChange={setFilter("type")}
          options={[
            { value: "", label: "Catalog and users' custom" },
            { value: "global", label: "Catalog only" },
            { value: "custom", label: "Users' custom only" },
          ]}
        />
        <Select
          label="Status"
          value={filters.status}
          onChange={setFilter("status")}
          options={[
            { value: "active", label: "Available" },
            { value: "archived", label: "Archived" },
            { value: "all", label: "All" },
          ]}
        />
        <Select
          label="Content"
          value={filters.completeness}
          onChange={setFilter("completeness")}
          options={[
            { value: "", label: "Any" },
            { value: "incomplete", label: "Missing images or steps" },
            { value: "missing_images", label: "Missing images" },
            { value: "missing_instructions", label: "Missing steps" },
          ]}
        />
      </div>

      <DataTable<AdminExerciseRow>
        columns={columns}
        data={list.rows}
        keyField="id"
        total={list.pagination.total}
        page={list.page}
        pageSize={PAGE_SIZE}
        onPageChange={list.setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchLabel="Search exercises"
        searchPlaceholder="Search name, muscle, equipment or category (e.g. “bench”, “db curl”)"
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field, dir) => {
          setSortField(field);
          setSortDir(dir);
        }}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        caption="Exercises"
        emptyMessage="No exercises match. Try fewer filters, or check Status: Archived."
        actions={(row) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/admin/exercises/${row.id}`}
              className={`${actionClass} hover:text-ink hover:bg-elevated`}
              title="Edit"
              aria-label={`Edit ${row.name}`}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Link>
            {row.archivedAt ? (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setTarget({ row, action: "restore" });
                }}
                className={`${actionClass} hover:text-ink hover:bg-elevated`}
                title="Restore"
                aria-label={`Restore ${row.name}`}
              >
                <ArchiveRestore className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void openArchive(row)}
                className={`${actionClass} hover:text-warn hover:bg-elevated`}
                title="Archive"
                aria-label={`Archive ${row.name}`}
              >
                <Archive className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      />

      <ConfirmDialog
        isOpen={Boolean(target)}
        onCancel={() => {
          if (!modalBusy) setTarget(null);
        }}
        onConfirm={runAction}
        title={target?.action === "restore" ? "Restore exercise" : "Archive exercise"}
        message={
          target?.action === "restore"
            ? `Make "${target.row.name}" available in the exercise picker again?`
            : `Archive "${target?.row.name ?? ""}"? It disappears from the exercise picker. Routines that contain it and logged workouts keep it, and you can restore it at any time.`
        }
        confirmLabel={target?.action === "restore" ? "Restore" : "Archive"}
        isWorking={modalBusy}
        error={modalError}
      >
        {target?.action === "archive" && (
          <p className="text-sm text-ink-2" aria-live="polite">
            {usageError
              ? `Usage could not be checked: ${usageError}`
              : usageText ?? "Checking where it is used…"}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

export default AdminExercisesClient;
