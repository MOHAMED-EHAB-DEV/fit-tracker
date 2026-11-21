"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed, Plus, Pencil, Trash2, Users, BookOpen } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { useAdminList } from "@/components/admin/useAdminList";
import { apiRequest, errorMessage } from "@/components/admin/api";
import { formatAdminDate, useAdminZone } from "@/components/admin/AdminZone";
import type { AdminPlanRow } from "@/lib/admin/nutrition-plans";

const PAGE_SIZE = 20;

const actionClass =
  "min-h-11 min-w-11 flex items-center justify-center rounded-xl text-zinc-300 transition cursor-pointer";

export function AdminNutritionClient() {
  const { toast } = useToast();
  const timeZone = useAdminZone();
  const [search, setSearch] = useState("");
  const [filterPublic, setFilterPublic] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const list = useAdminList<AdminPlanRow>(
    "/api/admin/nutrition/plans",
    "plans",
    { search: search.trim(), isPublic: filterPublic, sortField, sortDir },
    PAGE_SIZE
  );

  const [toDelete, setToDelete] = useState<AdminPlanRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const busy = useRef(false);

  const handleDelete = async () => {
    if (!toDelete || busy.current) return;
    busy.current = true;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/admin/nutrition/plans/${toDelete.id}`, { method: "DELETE" });
      toast(`"${toDelete.name}" was deleted`, "success");
      setToDelete(null);
      list.reload();
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      busy.current = false;
      setDeleteBusy(false);
    }
  };

  const columns: Column<AdminPlanRow>[] = [
    {
      key: "name",
      label: "Plan",
      sortable: true,
      render: (row) => (
        <Link
          href={`/admin/nutrition/${row.id}`}
          className="block min-h-11 py-1 rounded"
        >
          <span className="block font-semibold text-zinc-200 text-sm">{row.name}</span>
          {row.description && <span className="block text-xs text-zinc-400 truncate max-w-xs">{row.description}</span>}
        </Link>
      ),
    },
    {
      key: "targetCalories",
      label: "Calories",
      sortable: true,
      render: (row) => <span className="text-sm font-semibold text-zinc-300 tabular-nums">{row.targetCalories.toLocaleString()} kcal</span>,
    },
    {
      key: "targetProteinG",
      label: "Protein",
      render: (row) => <span className="text-xs text-zinc-300 tabular-nums">{row.targetProteinG} g</span>,
    },
    {
      key: "meals",
      label: "Meals",
      render: (row) => (
        <span className="flex items-center gap-1.5 text-xs text-zinc-300">
          <BookOpen className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span className="tabular-nums">{row.mealCount}</span>
        </span>
      ),
    },
    {
      key: "assigned",
      label: "Assigned",
      render: (row) => (
        <span className="flex items-center gap-1.5 text-xs text-zinc-300">
          <Users className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span className="tabular-nums">
            {row.assignedCount} user{row.assignedCount === 1 ? "" : "s"}
          </span>
        </span>
      ),
    },
    {
      key: "isPublic",
      label: "Visibility",
      render: (row) => (
        <Chip size="sm" variant="flat" color={row.isPublic ? "success" : "default"} className="text-xs">
          {row.isPublic ? "Public" : "Private"}
        </Chip>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (row) => <span className="text-xs text-zinc-400 tabular-nums">{formatAdminDate(row.createdAt, timeZone)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UtensilsCrossed className="w-5 h-5 text-violet-400" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-300">Nutrition</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Nutrition plans</h1>
          <p className="text-zinc-400 text-sm mt-1 tabular-nums">
            {list.pagination.total.toLocaleString()} plan{list.pagination.total === 1 ? "" : "s"} match these filters
          </p>
        </div>
        <Link
          href="/admin/nutrition/new"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New plan
        </Link>
      </div>

      <div className="w-full sm:w-56">
        <Select
          label="Visibility"
          options={[
            { value: "", label: "All plans" },
            { value: "true", label: "Public" },
            { value: "false", label: "Private" },
          ]}
          value={filterPublic}
          onChange={(value) => setFilterPublic(value || "")}
        />
      </div>

      <DataTable<AdminPlanRow>
        columns={columns}
        data={list.rows}
        keyField="id"
        total={list.pagination.total}
        page={list.page}
        pageSize={PAGE_SIZE}
        onPageChange={list.setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchLabel="Search nutrition plans by name"
        searchPlaceholder="Search plans by name…"
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field, dir) => {
          setSortField(field);
          setSortDir(dir);
        }}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        caption="Nutrition plans"
        emptyMessage="No nutrition plans match. Create one with New plan."
        actions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            <Link
              href={`/admin/nutrition/${row.id}`}
              aria-label={`Edit ${row.name}`}
              title="Edit"
              className={`${actionClass} hover:text-violet-300 hover:bg-violet-500/10`}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              aria-label={`Delete ${row.name}`}
              title="Delete"
              onClick={() => {
                setDeleteError(null);
                setToDelete(row);
              }}
              className={`${actionClass} hover:text-red-300 hover:bg-red-500/10`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={Boolean(toDelete)}
        onClose={() => {
          if (!deleteBusy) setToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete plan"
        message={
          toDelete
            ? `Delete "${toDelete.name}"?${toDelete.assignedCount ? ` It is assigned to ${toDelete.assignedCount} user${toDelete.assignedCount === 1 ? "" : "s"}, who will no longer have it.` : ""} This cannot be undone.`
            : ""
        }
        confirmLabel="Delete plan"
        confirmVariant="danger"
        isLoading={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

export default AdminNutritionClient;
