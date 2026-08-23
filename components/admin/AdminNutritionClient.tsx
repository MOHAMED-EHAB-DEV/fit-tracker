"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Plus, Pencil, Trash2, Users, BookOpen } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { formatDistanceToNow } from "date-fns";

export interface PlanRow {
  _id: string;
  name: string;
  description: string;
  targetCalories: number;
  targetProteinG: number;
  isPublic: boolean;
  assignedTo: any[];
  meals: any[];
  createdAt: string;
  createdBy?: { name: string; email: string } | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function AdminNutritionClient() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPublic, setFilterPublic] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    plan: PlanRow | null;
    isLoading: boolean;
  }>({ open: false, plan: null, isLoading: false });

  const fetchPlans = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
          search,
          ...(filterPublic !== "" && { isPublic: filterPublic }),
        });
        const res = await fetch(`/api/admin/nutrition/plans?${params}`);
        const data = await res.json();
        if (data.success) {
          setPlans(data.plans);
          setPagination(data.pagination);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [search, filterPublic]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchPlans(1), 300);
    return () => clearTimeout(t);
  }, [fetchPlans]);

  const handleDelete = async () => {
    if (!deleteModal.plan) return;
    setDeleteModal((m) => ({ ...m, isLoading: true }));
    await fetch(`/api/admin/nutrition/plans/${deleteModal.plan._id}`, {
      method: "DELETE",
    });
    setDeleteModal({ open: false, plan: null, isLoading: false });
    fetchPlans(pagination.page);
  };

  const columns: Column<PlanRow>[] = [
    {
      key: "name",
      label: "Plan",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-zinc-200 text-sm">{row.name}</p>
          {row.description && (
            <p className="text-[11px] text-zinc-500 truncate max-w-xs">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "targetCalories",
      label: "Target Calories",
      sortable: true,
      render: (row) => (
        <span className="text-sm font-semibold text-zinc-300 tabular-nums">
          {row.targetCalories.toLocaleString()} kcal
        </span>
      ),
    },
    {
      key: "targetProteinG",
      label: "Protein",
      render: (row) => <span className="text-xs text-zinc-400 font-medium tabular-nums">{row.targetProteinG}g</span>,
    },
    {
      key: "meals",
      label: "Meals",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <BookOpen className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" /> <span className="tabular-nums">{row.meals?.length ?? 0}</span>
        </div>
      ),
    },
    {
      key: "assignedTo",
      label: "Assigned",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Users className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" /> <span className="tabular-nums">{row.assignedTo?.length ?? 0}</span> users
        </div>
      ),
    },
    {
      key: "isPublic",
      label: "Visibility",
      render: (row) =>
        row.isPublic ? (
          <Chip size="sm" variant="flat" color="success">
            Public
          </Chip>
        ) : (
          <Chip size="sm" variant="flat" color="default">
            Private
          </Chip>
        ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-zinc-500 tabular-nums">
          {row.createdAt
            ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UtensilsCrossed className="w-5 h-5 text-violet-400" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
              Nutrition
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Nutrition Plans</h1>
          <p className="text-zinc-400 text-sm mt-1 tabular-nums">{pagination.total} plans created</p>
        </div>
        <Button
          onClick={() => router.push("/admin/nutrition/new")}
          startContent={<Plus className="w-4 h-4" aria-hidden="true" />}
          className="bg-violet-600 hover:bg-violet-500 text-white font-bold shadow-lg shadow-violet-600/25 self-start sm:self-auto"
        >
          New Plan
        </Button>
      </div>

      {/* Filter */}
      <div className="w-full sm:w-48">
        <Select
          options={[
            { value: "", label: "All Plans" },
            { value: "true", label: "Public" },
            { value: "false", label: "Private" },
          ]}
          value={filterPublic}
          onChange={(val) => setFilterPublic(val || "")}
          placeholder="All Plans"
          ariaLabel="Filter by visibility"
        />
      </div>

      <DataTable
        columns={columns}
        data={plans}
        keyField="_id"
        total={pagination.total}
        page={pagination.page}
        pageSize={pagination.limit}
        onPageChange={(p) => fetchPlans(p)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search nutrition plans…"
        isLoading={isLoading}
        emptyMessage="No nutrition plans yet. Create one!"
        actions={(row) => (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${row.name}`}
              onClick={() => router.push(`/admin/nutrition/${row._id}`)}
              className="p-2 h-8 w-8 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${row.name}`}
              onClick={() => setDeleteModal({ open: true, plan: row, isLoading: false })}
              className="p-2 h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, plan: null, isLoading: false })}
        onConfirm={handleDelete}
        title="Delete Plan"
        message={`Delete "${deleteModal.plan?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteModal.isLoading}
      />
    </div>
  );
}

export default AdminNutritionClient;
