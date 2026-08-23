"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  Shield,
  Trash2,
  Eye,
  Ban,
  CheckCircle,
} from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { formatDistanceToNow } from "date-fns";

export interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isBanned: boolean;
  isProfileComplete: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  fitnessProfile?: { goal?: string };
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function AdminUsersClient() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterRole, setFilterRole] = useState("");
  const [filterBanned, setFilterBanned] = useState("");

  // Confirm modal state
  const [modal, setModal] = useState<{
    open: boolean;
    type: "delete" | "ban" | "unban" | "promote" | "demote";
    user: UserRow | null;
    isLoading: boolean;
  }>({ open: false, type: "delete", user: null, isLoading: false });

  const fetchUsers = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
          search,
          sortField,
          sortDir,
          ...(filterRole && { role: filterRole }),
          ...(filterBanned !== "" && { isBanned: filterBanned }),
        });
        const res = await fetch(`/api/admin/users?${params}`);
        const data = await res.json();
        if (data.success) {
          setUsers(data.users);
          setPagination(data.pagination);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [search, sortField, sortDir, filterRole, filterBanned]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(1), 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const handleAction = async () => {
    if (!modal.user) return;
    setModal((m) => ({ ...m, isLoading: true }));
    try {
      const { type, user } = modal;
      if (type === "delete") {
        await fetch(`/api/admin/users/${user._id}`, { method: "DELETE" });
      } else if (type === "ban" || type === "unban") {
        await fetch(`/api/admin/users/${user._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isBanned: type === "ban" }),
        });
      } else if (type === "promote" || type === "demote") {
        await fetch(`/api/admin/users/${user._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: type === "promote" ? "admin" : "user" }),
        });
      }
      setModal({ open: false, type: "delete", user: null, isLoading: false });
      fetchUsers(pagination.page);
    } catch {
      setModal((m) => ({ ...m, isLoading: false }));
    }
  };

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      label: "User",
      sortable: true,
      render: (row: UserRow) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center font-bold text-xs shrink-0">
            {row.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-zinc-200 text-sm">{row.name}</p>
            <p className="text-[11px] text-zinc-500 font-mono">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (row: UserRow) => (
        <Chip
          size="sm"
          variant="flat"
          color={row.role === "admin" ? "primary" : "default"}
          startContent={row.role === "admin" ? <ShieldCheck className="w-3 h-3 text-violet-400" aria-hidden="true" /> : undefined}
          className="capitalize text-[10px]"
        >
          {row.role}
        </Chip>
      ),
    },
    {
      key: "isBanned",
      label: "Status",
      render: (row: UserRow) =>
        row.isBanned ? (
          <Chip size="sm" variant="flat" color="danger" className="uppercase text-[10px]">
            Banned
          </Chip>
        ) : row.isProfileComplete ? (
          <Chip size="sm" variant="flat" color="success" className="uppercase text-[10px]">
            Active
          </Chip>
        ) : (
          <Chip size="sm" variant="flat" color="warning" className="uppercase text-[10px]">
            Incomplete
          </Chip>
        ),
    },
    {
      key: "createdAt",
      label: "Joined",
      sortable: true,
      render: (row: UserRow) => (
        <span className="text-xs text-zinc-500 tabular-nums">
          {row.createdAt
            ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })
            : "—"}
        </span>
      ),
    },
  ];

  const modalConfig: Record<string, { title: string; message: string; confirmLabel: string; confirmVariant: "danger" | "warning" | "primary" }> = {
    delete: {
      title: "Delete User",
      message: `Permanently delete ${modal.user?.name}? All their workouts, meals, and check-in logs will also be erased.`,
      confirmLabel: "Delete User",
      confirmVariant: "danger",
    },
    ban: {
      title: "Ban User",
      message: `Ban ${modal.user?.name}? They will no longer be able to log in or use the platform.`,
      confirmLabel: "Ban User",
      confirmVariant: "danger",
    },
    unban: {
      title: "Unban User",
      message: `Restore access for ${modal.user?.name}?`,
      confirmLabel: "Unban",
      confirmVariant: "primary",
    },
    promote: {
      title: "Promote to Admin",
      message: `Grant administrative privileges to ${modal.user?.name}? They will have full control over all platform data.`,
      confirmLabel: "Promote",
      confirmVariant: "primary",
    },
    demote: {
      title: "Demote to User",
      message: `Remove administrative privileges from ${modal.user?.name}?`,
      confirmLabel: "Demote",
      confirmVariant: "danger",
    },
  };

  const currentModalConfig = modalConfig[modal.type];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
        <p className="text-zinc-500 text-xs mt-0.5 tabular-nums">
          {pagination.total.toLocaleString()} registered accounts on the platform
        </p>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
        <Select
          label="Role"
          value={filterRole}
          onChange={setFilterRole}
          options={[
            { value: "", label: "All Roles" },
            { value: "user", label: "Users" },
            { value: "admin", label: "Admins" },
          ]}
        />
        <Select
          label="Status"
          value={filterBanned}
          onChange={setFilterBanned}
          options={[
            { value: "", label: "All Statuses" },
            { value: "false", label: "Active" },
            { value: "true", label: "Banned" },
          ]}
        />
      </div>

      {/* Table */}
      <DataTable<UserRow>
        columns={columns}
        data={users}
        keyField="_id"
        total={pagination.total}
        page={pagination.page}
        pageSize={pagination.limit}
        onPageChange={(p) => fetchUsers(p)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email..."
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => {
          setSortField(f);
          setSortDir(d);
        }}
        isLoading={isLoading}
        emptyMessage="No users found matching your search."
        actions={(row: UserRow) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => router.push(`/admin/users/${row._id}`)}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              title="View user details"
              aria-label={`View ${row.name}`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() =>
                setModal({
                  open: true,
                  type: row.role === "admin" ? "demote" : "promote",
                  user: row,
                  isLoading: false,
                })
              }
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              title={row.role === "admin" ? "Demote to user" : "Promote to admin"}
              aria-label={row.role === "admin" ? `Demote ${row.name}` : `Promote ${row.name}`}
            >
              {row.role === "admin" ? (
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setModal({
                  open: true,
                  type: row.isBanned ? "unban" : "ban",
                  user: row,
                  isLoading: false,
                })
              }
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title={row.isBanned ? "Unban user" : "Ban user"}
              aria-label={row.isBanned ? `Unban ${row.name}` : `Ban ${row.name}`}
            >
              {row.isBanned ? (
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Ban className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setModal({
                  open: true,
                  type: "delete",
                  user: row,
                  isLoading: false,
                })
              }
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              title="Delete user"
              aria-label={`Delete ${row.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, type: "delete", user: null, isLoading: false })}
        onConfirm={handleAction}
        title={currentModalConfig?.title || ""}
        message={currentModalConfig?.message || ""}
        confirmLabel={currentModalConfig?.confirmLabel || ""}
        confirmVariant={currentModalConfig?.confirmVariant || "danger"}
        isLoading={modal.isLoading}
      />
    </div>
  );
}

export default AdminUsersClient;
