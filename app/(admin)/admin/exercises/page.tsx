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

interface ExerciseRow {
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

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminExercisesPage() {
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
      render: (row) => {
        const isStretch = row.category === "stretching" || row.equipment === "bodyweight";

        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-center text-zinc-400 shrink-0">
              {isStretch ? (
                <Activity className="w-4 h-4 text-cyan-400" />
              ) : (
                <Dumbbell className="w-4 h-4 text-zinc-400" />
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
      render: (row) => <span className="text-xs text-zinc-400 font-medium">{row.primaryMuscle}</span>,
    },
    {
      key: "equipment",
      label: "Equipment",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-zinc-400 capitalize font-medium">
          {row.equipment.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-zinc-400 capitalize font-medium">
          {row.category.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "level",
      label: "Level",
      render: (row) =>
        row.level ? (
          <Chip
            size="sm"
            variant="flat"
            color={
              row.level === "beginner"
                ? "success"
                : row.level === "intermediate"
                ? "warning"
                : "danger"
            }
            className="capitalize text-[10px]"
          >
            {row.level}
          </Chip>
        ) : (
          <span className="text-zinc-600 text-xs">—</span>
        ),
    },
    {
      key: "metValue",
      label: "MET",
      sortable: true,
      render: (row) => <span className="text-xs text-zinc-500 font-mono">{row.metValue}</span>,
    },
  ];

  const muscleOptions = [
    { value: "", label: "All Muscles" },
    ...MUSCLE_OPTIONS,
  ];

  const equipmentOptions = [
    { value: "", label: "All Equipment" },
    ...EQUIPMENT_SELECT_OPTIONS,
  ];

  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...CATEGORY_OPTIONS,
  ];

  const typeOptions = [
    { value: "", label: "All Types" },
    { value: "false", label: "Global Catalog" },
    { value: "true", label: "Custom Exercises" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="w-5 h-5 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
              Catalog
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Exercises</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {pagination.total.toLocaleString()} exercises in catalog
          </p>
        </div>
        <Button
          onClick={() => router.push("/admin/exercises/new")}
          startContent={<Plus className="w-4 h-4" />}
          className="bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-600/25 self-start sm:self-auto"
        >
          Add Exercise
        </Button>
      </div>

      {/* HeroUI Custom Select Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          options={muscleOptions}
          value={filterMuscle}
          onChange={(val) => setFilterMuscle(val || "")}
          placeholder="All Muscles"
          searchable
          ariaLabel="Filter by muscle"
        />
        <Select
          options={equipmentOptions}
          value={filterEquipment}
          onChange={(val) => setFilterEquipment(val || "")}
          placeholder="All Equipment"
          searchable
          ariaLabel="Filter by equipment"
        />
        <Select
          options={categoryOptions}
          value={filterCategory}
          onChange={(val) => setFilterCategory(val || "")}
          placeholder="All Categories"
          ariaLabel="Filter by category"
        />
        <Select
          options={typeOptions}
          value={filterCustom}
          onChange={(val) => setFilterCustom(val || "")}
          placeholder="All Types"
          ariaLabel="Filter by type"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={exercises}
        keyField="_id"
        total={pagination.total}
        page={pagination.page}
        pageSize={pagination.limit}
        onPageChange={(p) => fetchExercises(p)}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => {
          setSortField(f);
          setSortDir(d);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exercises…"
        isLoading={isLoading}
        emptyMessage="No exercises found"
        actions={(row) => (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit exercise"
              onClick={() => router.push(`/admin/exercises/${row._id}`)}
              className="p-2 h-8 w-8 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete exercise"
              onClick={() => setDeleteModal({ open: true, exercise: row, isLoading: false })}
              className="p-2 h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, exercise: null, isLoading: false })}
        onConfirm={handleDelete}
        title="Delete Exercise"
        message={`Delete "${deleteModal.exercise?.name}" from the catalog? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  );
}

