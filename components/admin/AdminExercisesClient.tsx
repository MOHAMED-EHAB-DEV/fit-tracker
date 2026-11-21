"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Dumbbell, Plus, Pencil, Archive, ArchiveRestore, Activity, Timer, ImageOff, ListX } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
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

const PAGE_SIZE = 30;

const actionClass =
  "min-h-11 min-w-11 flex items-center justify-center rounded-lg text-zinc-300 transition cursor-pointer";

const label = (map: Record<string, string>, value: string) => map[value] || value;

function TrackingIcon({ type }: { type: string }) {
  if (type === "duration") return <Timer className="w-4 h-4 text-cyan-400" aria-hidden="true" />;
  if (type === "cardio") return <Activity className="w-4 h-4 text-rose-400" aria-hidden="true" />;
  return <Dumbbell className="w-4 h-4 text-zinc-300" aria-hidden="true" />;
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
          <span className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
            <TrackingIcon type={row.trackingType} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-zinc-100 text-sm">{row.name}</span>
              {row.isCustom && (
                <Chip size="sm" variant="flat" color="primary" className="text-xs">User&apos;s custom</Chip>
              )}
              {row.archivedAt && (
                <Chip size="sm" variant="flat" color="warning" className="text-xs">Archived</Chip>
              )}
            </span>
            <span className="block text-xs text-zinc-400">{label(TRACKING_TYPE_LABELS, row.trackingType)}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "primaryMuscle",
      label: "Muscle",
      sortable: true,
      render: (row) => <span className="text-sm text-zinc-300">{row.primaryMuscle}</span>,
    },
    {
      key: "equipment",
      label: "Equipment",
      sortable: true,
      render: (row) => <span className="text-sm text-zinc-300">{label(EQUIPMENT_LABELS, row.equipment)}</span>,
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (row) => <span className="text-sm text-zinc-300">{label(CATEGORY_LABELS, row.category)}</span>,
    },
    {
      key: "metValue",
      label: "MET",
      sortable: true,
      render: (row) => <span className="font-mono text-sm text-zinc-300 tabular-nums">{row.metValue.toFixed(1)}</span>,
    },
    {
      key: "completeness",
      label: "Content",
      render: (row) =>
        row.imageCount > 0 && row.instructionCount > 0 ? (
          <span className="text-xs text-emerald-300 tabular-nums">
            {row.imageCount} image{row.imageCount === 1 ? "" : "s"}, {row.instructionCount} step{row.instructionCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="flex flex-col gap-1">
            {row.imageCount === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                <ImageOff className="w-3.5 h-3.5" aria-hidden="true" /> No images
              </span>
            )}
            {row.instructionCount === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-300">
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Exercise catalog</h1>
          <p className="text-zinc-400 text-sm mt-0.5 tabular-nums">
            {list.pagination.total.toLocaleString()} exercise{list.pagination.total === 1 ? "" : "s"} match these filters
          </p>
        </div>
        <Link
          href="/admin/exercises/new"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Add exercise
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
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
              className={`${actionClass} hover:text-white hover:bg-zinc-800/60`}
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
                className={`${actionClass} hover:text-emerald-300 hover:bg-emerald-500/10`}
                title="Restore"
                aria-label={`Restore ${row.name}`}
              >
                <ArchiveRestore className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void openArchive(row)}
                className={`${actionClass} hover:text-amber-300 hover:bg-amber-500/10`}
                title="Archive"
                aria-label={`Archive ${row.name}`}
              >
                <Archive className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      />

      <ConfirmModal
        isOpen={Boolean(target)}
        onClose={() => {
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
        confirmVariant={target?.action === "restore" ? "primary" : "warning"}
        isLoading={modalBusy}
        error={modalError}
      >
        {target?.action === "archive" && (
          <p className="text-sm text-zinc-300" aria-live="polite">
            {usageError
              ? `Usage could not be checked: ${usageError}`
              : usageText ?? "Checking where it is used…"}
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}

export default AdminExercisesClient;
