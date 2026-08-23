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

interface UserRow {
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

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminUsersPage() {
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
      render: (row) => (
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
      render: (row) => (
        <Chip
          size="sm"
          variant="flat"
          color={row.role === "admin" ? "primary" : "default"}
          startContent={row.role === "admin" ? <ShieldCheck className="w-3 h-3 text-violet-400" /> : undefined}
          className="capitalize text-[10px]"
        >
          {row.role}
        </Chip>
      ),
    },
    {
      key: "isBanned",
      label: "Status",
      render: (row) =>
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
      key: "goal",
      label: "Goal",
      render: (row) => (
        <span className="text-xs text-zinc-400 capitalize font-medium">{row.fitnessProfile?.goal || "—"}</span>
      ),
    },
    {
      key: "lastLoginAt",
      label: "Last Login",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-zinc-500">
          {row.lastLoginAt
            ? formatDistanceToNow(new Date(row.lastLoginAt), { addSuffix: true })
            : "Never"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Joined",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-zinc-500">
          {row.createdAt ? formatDistanceToNow(new Date(row.createdAt), { addSuffix: true }) : "—"}
        </span>
      ),
    },
  ];

  const modalConfig = {
    delete: {
      title: "Delete User",
      message: `Delete "${modal.user?.name}"? This will permanently erase all their workouts, meals, and data. This cannot be undone.`,
      confirmLabel: "Delete Permanently",
      confirmVariant: "danger" as const,
    },
    ban: {
      title: "Ban User",
      message: `Ban "${modal.user?.name}"? They will be unable to access the app.`,
      confirmLabel: "Ban User",
      confirmVariant: "danger" as const,
    },
    unban: {
      title: "Unban User",
      message: `Restore access for "${modal.user?.name}"?`,
      confirmLabel: "Unban",
      confirmVariant: "primary" as const,
    },
    promote: {
      title: "Promote to Admin",
      message: `Grant admin privileges to "${modal.user?.name}"? They will have full access to this admin panel.`,
      confirmLabel: "Promote",
      confirmVariant: "primary" as const,
    },
    demote: {
      title: "Revoke Admin Access",
      message: `Remove admin privileges from "${modal.user?.name}"?`,
      confirmLabel: "Revoke Admin",
      confirmVariant: "warning" as const,
    },
  };

  const current = modalConfig[modal.type];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-violet-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
              Management
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Users</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {pagination.total.toLocaleString()} registered users
          </p>
        </div>
      </div>

      {/* HeroUI Select Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select
            options={[
              { value: "", label: "All Roles" },
              { value: "user", label: "User" },
              { value: "admin", label: "Admin" },
            ]}
            value={filterRole}
            onChange={(val) => setFilterRole(val || "")}
            placeholder="All Roles"
            ariaLabel="Filter by role"
          />
        </div>
        <div className="w-44">
          <Select
            options={[
              { value: "", label: "All Status" },
              { value: "false", label: "Active" },
              { value: "true", label: "Banned" },
            ]}
            value={filterBanned}
            onChange={(val) => setFilterBanned(val || "")}
            placeholder="All Status"
            ariaLabel="Filter by status"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={users}
        keyField="_id"
        total={pagination.total}
        page={pagination.page}
        pageSize={pagination.limit}
        onPageChange={(p) => fetchUsers(p)}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(f, d) => {
          setSortField(f);
          setSortDir(d);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or email…"
        isLoading={isLoading}
        emptyMessage="No users found"
        actions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              aria-label="View Details"
              onClick={() => router.push(`/admin/users/${row._id}`)}
              className="p-2 h-8 w-8 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={row.isBanned ? "Unban" : "Ban"}
              onClick={() =>
                setModal({
                  open: true,
                  type: row.isBanned ? "unban" : "ban",
                  user: row,
                  isLoading: false,
                })
              }
              className="p-2 h-8 w-8 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl"
            >
              {row.isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={row.role === "admin" ? "Revoke Admin" : "Promote to Admin"}
              onClick={() =>
                setModal({
                  open: true,
                  type: row.role === "admin" ? "demote" : "promote",
                  user: row,
                  isLoading: false,
                })
              }
              className="p-2 h-8 w-8 text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl"
            >
              {row.role === "admin" ? <Shield className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete User"
              onClick={() =>
                setModal({
                  open: true,
                  type: "delete",
                  user: row,
                  isLoading: false,
                })
              }
              className="p-2 h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      />

      <ConfirmModal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, type: "delete", user: null, isLoading: false })}
        onConfirm={handleAction}
        title={current.title}
        message={current.message}
        confirmLabel={current.confirmLabel}
        confirmVariant={current.confirmVariant}
        isLoading={modal.isLoading}
      />
    </div>
  );
}

