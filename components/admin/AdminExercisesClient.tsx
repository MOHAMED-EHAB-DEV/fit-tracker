"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Plus, Pencil, Trash2, Activity } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import {
  MUSCLE_OPTIONS,
  EQUIPMENT_SELECT_OPTIONS,
  CATEGORY_OPTIONS,
} from "@/constants/exercise";

export interface ExerciseRow {
  _id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  category: string;
  level: string | null;
  metValue: number;
  isCustom: boolean;
  images?: string[];
  createdAt: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function AdminExercisesClient() {
  const router = useRouter();
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 30,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterMuscle, setFilterMuscle] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCustom, setFilterCustom] = useState("");

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    exercise: ExerciseRow | null;
    isLoading: boolean;
  }>({
    open: false,
    exercise: null,
    isLoading: false,
  });

  const fetchExercises = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "30",
          search,
          sortField,
          sortDir,
          ...(filterMuscle && { muscle: filterMuscle }),
          ...(filterEquipment && { equipment: filterEquipment }),
          ...(filterCategory && { category: filterCategory }),
          ...(filterCustom !== "" && { isCustom: filterCustom }),
        });
        const res = await fetch(`/api/admin/exercises?${params}`);
        const data = await res.json();
        if (data.success) {
          setExercises(data.exercises);
          setPagination(data.pagination);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [search, sortField, sortDir, filterMuscle, filterEquipment, filterCategory, filterCustom]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchExercises(1), 300);
    return () => clearTimeout(t);
  }, [fetchExercises]);

  const handleDelete = async () => {
    if (!deleteModal.exercise) return;
    setDeleteModal((m) => ({ ...m, isLoading: true }));
    await fetch(`/api/admin/exercises/${deleteModal.exercise._id}`, {
      method: "DELETE",
    });
    setDeleteModal({ open: false, exercise: null, isLoading: false });
    fetchExercises(pagination.page);
  };

  const columns: Column<ExerciseRow>[] = [
    {
      key: "name",
      label: "Exercise",
      sortable: true,
      render: (row: ExerciseRow) => {
        const isStretch = row.category === "stretching" || row.equipment === "bodyweight";

        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0">
              {isStretch ? (
                <Activity className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              ) : (
                <Dumbbell className="w-4 h-4 text-zinc-400" aria-hidden="true" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-zinc-200 text-sm leading-tight">{row.name}</p>
                {row.isCustom && (
                  <Chip size="sm" variant="flat" color="primary">
                    Custom
                  </Chip>
                )}
                {isStretch && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
                    Stretch
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "primaryMuscle",
      label: "Muscle",
      sortable: true,
      render: (row: ExerciseRow) => <span className="text-xs text-zinc-400 font-medium">{row.primaryMuscle}</span>,
    },
    {
      key: "equipment",
      label: "Equipment",
      sortable: true,
      render: (row: ExerciseRow) => (
        <span className="text-xs text-zinc-400 capitalize font-medium">
          {row.equipment.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (row: ExerciseRow) => (
        <Chip size="sm" variant="flat" color="default">
          {row.category}
        </Chip>
      ),
    },
    {
      key: "metValue",
      label: "MET Value",
      sortable: true,
      render: (row: ExerciseRow) => (
        <span className="font-mono text-xs text-zinc-400 tabular-nums">
          {row.metValue ? row.metValue.toFixed(1) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Exercise Catalog</h1>
          <p className="text-zinc-500 text-xs mt-0.5 tabular-nums">
            {pagination.total.toLocaleString()} total movements available in the database
          </p>
        </div>
        <Button
          color="primary"
          startContent={<Plus className="w-4 h-4" aria-hidden="true" />}
          onClick={() => router.push("/admin/exercises/new")}
        >
          Add Exercise
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
        <Select
          label="Muscle Group"
          value={filterMuscle}
          onChange={setFilterMuscle}
          options={[{ value: "", label: "All Muscles" }, ...MUSCLE_OPTIONS]}
        />
        <Select
          label="Equipment"
          value={filterEquipment}
          onChange={setFilterEquipment}
          options={[{ value: "", label: "All Equipment" }, ...EQUIPMENT_SELECT_OPTIONS]}
        />
        <Select
          label="Category"
          value={filterCategory}
          onChange={setFilterCategory}
          options={[{ value: "", label: "All Categories" }, ...CATEGORY_OPTIONS]}
        />
        <Select
          label="Type"
          value={filterCustom}
          onChange={setFilterCustom}
          options={[
            { value: "", label: "All Types" },
            { value: "true", label: "Custom Only" },
            { value: "false", label: "Global Only" },
          ]}
        />
      </div>

      {/* Table */}
      <DataTable<ExerciseRow>
        columns={columns}
        data={exercises}
        keyField="_id"
        total={pagination.total}
        page={pagination.page}
        pageSize={pagination.limit}
        onPageChange={(p) => fetchExercises(p)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, muscle, equipment..."
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => {
          setSortField(f);
          setSortDir(d);
        }}
        isLoading={isLoading}
        emptyMessage="No exercises found matching your search."
        actions={(row: ExerciseRow) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => router.push(`/admin/exercises/${row._id}`)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              title="Edit exercise"
              aria-label={`Edit ${row.name}`}
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteModal({ open: true, exercise: row, isLoading: false })}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              title="Delete exercise"
              aria-label={`Delete ${row.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      />

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, exercise: null, isLoading: false })}
        onConfirm={handleDelete}
        title="Delete Exercise"
        message={`Are you sure you want to delete "${deleteModal.exercise?.name}"? This will remove it from the global catalog.`}
        confirmLabel="Delete Exercise"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  );
}

export default AdminExercisesClient;
