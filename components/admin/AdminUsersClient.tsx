"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Shield, Trash2, Eye, Ban, CheckCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Select } from "@/components/ui/Select";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { useAdminList } from "@/components/admin/useAdminList";
import { apiRequest, errorMessage } from "@/components/admin/api";
import { formatAdminDate, useAdminZone } from "@/components/admin/AdminZone";
import { userActionCopy, type UserAction } from "@/components/admin/userActions";
import type { AdminUserRow } from "@/lib/admin/users";

const PAGE_SIZE = 20;

const actionButton =
  "min-h-11 min-w-11 flex items-center justify-center rounded-lg text-zinc-300 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

export function AdminUsersClient({ currentAdminId }: { currentAdminId: string }) {
  const { toast } = useToast();
  const timeZone = useAdminZone();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterRole, setFilterRole] = useState("");
  const [filterBanned, setFilterBanned] = useState("");

  const list = useAdminList<AdminUserRow>(
    "/api/admin/users",
    "users",
    { search: search.trim(), sortField, sortDir, role: filterRole, isBanned: filterBanned },
    PAGE_SIZE
  );
  const activeAdmins = typeof list.meta.activeAdmins === "number" ? list.meta.activeAdmins : 0;

  const [modal, setModal] = useState<{ action: UserAction; user: AdminUserRow } | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const busy = useRef(false);

  const openModal = (action: UserAction, user: AdminUserRow) => {
    setModalError(null);
    setModal({ action, user });
  };

  const runAction = async () => {
    if (!modal || busy.current) return;
    busy.current = true;
    setModalBusy(true);
    setModalError(null);
    const { action, user } = modal;
    try {
      if (action === "delete") {
        const data = await apiRequest<{ message: string }>(`/api/admin/users/${user.id}`, { method: "DELETE" });
        toast(data.message, data.message.includes("could not") ? "warning" : "success");
      } else {
        const body =
          action === "ban" || action === "unban"
            ? { isBanned: action === "ban" }
            : { role: action === "promote" ? "admin" : "user" };
        await apiRequest(`/api/admin/users/${user.id}`, { method: "PATCH", body });
        toast(userActionCopy(action, user.name).done, "success");
      }
      setModal(null);
      list.reload();
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      busy.current = false;
      setModalBusy(false);
    }
  };

  const columns: Column<AdminUserRow>[] = [
    {
      key: "name",
      label: "User",
      sortable: true,
      render: (row) => (
        <Link
          href={`/admin/users/${row.id}`}
          className="flex items-center gap-3 min-h-11 rounded"
        >
          <span className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 flex items-center justify-center font-bold text-xs shrink-0" aria-hidden="true">
            {row.name?.charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-zinc-200 text-sm">
              {row.name}
              {row.id === currentAdminId && <span className="ml-2 text-xs font-bold text-violet-300">(you)</span>}
            </span>
            <span className="block text-xs text-zinc-400 font-mono">{row.email}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (row) => (
        <Chip size="sm" variant="flat" color={row.role === "admin" ? "primary" : "default"} className="capitalize text-xs">
          {row.role}
        </Chip>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) =>
        row.isBanned ? (
          <Chip size="sm" variant="flat" color="danger" className="text-xs">Banned</Chip>
        ) : row.isProfileComplete ? (
          <Chip size="sm" variant="flat" color="success" className="text-xs">Profile complete</Chip>
        ) : (
          <Chip size="sm" variant="flat" color="warning" className="text-xs">Profile incomplete</Chip>
        ),
    },
    {
      key: "createdAt",
      label: "Joined",
      sortable: true,
      render: (row) => <span className="text-xs text-zinc-400 tabular-nums">{formatAdminDate(row.createdAt, timeZone)}</span>,
    },
    {
      key: "lastLoginAt",
      label: "Last sign-in",
      sortable: true,
      render: (row) => <span className="text-xs text-zinc-400 tabular-nums">{formatAdminDate(row.lastLoginAt, timeZone)}</span>,
    },
  ];

  const lockReason = (row: AdminUserRow): string | null => {
    if (row.id === currentAdminId) return "You cannot change your own role, ban or delete yourself";
    if (row.role === "admin" && !row.isBanned && activeAdmins <= 1) return "The last admin who can sign in cannot be demoted, banned or deleted";
    return null;
  };

  const copy = modal ? userActionCopy(modal.action, modal.user.name) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
        <p className="text-zinc-400 text-sm mt-0.5 tabular-nums">
          {list.pagination.total.toLocaleString()} account{list.pagination.total === 1 ? "" : "s"} match these filters
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
        <Select
          label="Role"
          value={filterRole}
          onChange={(value) => setFilterRole(value || "")}
          options={[
            { value: "", label: "All roles" },
            { value: "user", label: "Users" },
            { value: "admin", label: "Admins" },
          ]}
        />
        <Select
          label="Status"
          value={filterBanned}
          onChange={(value) => setFilterBanned(value || "")}
          options={[
            { value: "", label: "All" },
            { value: "false", label: "Not banned" },
            { value: "true", label: "Banned" },
          ]}
        />
      </div>

      <DataTable<AdminUserRow>
        columns={columns}
        data={list.rows}
        keyField="id"
        total={list.pagination.total}
        page={list.page}
        pageSize={PAGE_SIZE}
        onPageChange={list.setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchLabel="Search users by name or email"
        searchPlaceholder="Search by name or email…"
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field, dir) => {
          setSortField(field);
          setSortDir(dir);
        }}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        caption="Users"
        emptyMessage="No users match your search."
        actions={(row) => {
          const locked = lockReason(row);
          return (
            <div className="flex items-center justify-end gap-1">
              <Link
                href={`/admin/users/${row.id}`}
                className={`${actionButton} hover:text-white hover:bg-zinc-800/60`}
                aria-label={`Open ${row.name}`}
                title="Open user"
              >
                <Eye className="w-4 h-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                disabled={Boolean(locked)}
                onClick={() => openModal(row.role === "admin" ? "demote" : "promote", row)}
                className={`${actionButton} hover:text-violet-300 hover:bg-violet-500/10`}
                title={locked || (row.role === "admin" ? "Remove admin rights" : "Make admin")}
                aria-label={row.role === "admin" ? `Remove admin rights from ${row.name}` : `Make ${row.name} an admin`}
              >
                {row.role === "admin" ? <Shield className="w-4 h-4" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                disabled={Boolean(locked)}
                onClick={() => openModal(row.isBanned ? "unban" : "ban", row)}
                className={`${actionButton} hover:text-amber-300 hover:bg-amber-500/10`}
                title={locked || (row.isBanned ? "Unban" : "Ban")}
                aria-label={row.isBanned ? `Unban ${row.name}` : `Ban ${row.name}`}
              >
                {row.isBanned ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : <Ban className="w-4 h-4" aria-hidden="true" />}
              </button>
              <button
                type="button"
                disabled={Boolean(locked)}
                onClick={() => openModal("delete", row)}
                className={`${actionButton} hover:text-red-300 hover:bg-red-500/10`}
                title={locked || "Delete user"}
                aria-label={`Delete ${row.name}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        }}
      />

      <ConfirmModal
        isOpen={Boolean(modal)}
        onClose={() => {
          if (!modalBusy) setModal(null);
        }}
        onConfirm={runAction}
        title={copy?.title || ""}
        message={copy?.message || ""}
        confirmLabel={copy?.confirmLabel || "Confirm"}
        confirmVariant={copy?.variant || "danger"}
        isLoading={modalBusy}
        error={modalError}
      />
    </div>
  );
}

export default AdminUsersClient;
