"use client";

import React from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sortField?: string;
  sortDir?: "asc" | "desc";
  onSort?: (field: string, dir: "asc" | "desc") => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  keyField,
  total,
  page,
  pageSize,
  onPageChange,
  sortField,
  sortDir,
  onSort,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  isLoading = false,
  actions,
  emptyMessage = "No records found",
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize);

  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const nextDir = sortField === col.key && sortDir === "asc" ? "desc" : "asc";
    onSort(col.key, nextDir);
  };

  const SortIcon = ({ col }: { col: Column<T> }) => {
    if (!col.sortable) return null;
    if (sortField !== col.key) return <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-600" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 text-violet-400" />
      : <ChevronDown className="w-3.5 h-3.5 text-violet-400" />;
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      {onSearchChange && (
        <div>
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            startContent={<Search className="w-4 h-4 text-zinc-500" />}
            variant="bordered"
            radius="md"
            className="bg-zinc-900/60 border-zinc-800/60 text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/60"
          />
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-zinc-800/60 bg-zinc-950/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60 bg-zinc-900/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap",
                    col.sortable && "cursor-pointer hover:text-zinc-200 select-none",
                    col.className
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <SortIcon col={col} />
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-800/30">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div className="h-4 bg-zinc-800/60 rounded-lg animate-pulse" />
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3.5"><div className="h-4 bg-zinc-800/60 rounded-lg animate-pulse" /></td>}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-zinc-500 text-sm font-medium"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={String(row[keyField])}
                  className="border-b border-zinc-800/30 hover:bg-violet-500/5 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3.5 text-zinc-300", col.className)}>
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500 px-1">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous page"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 h-8 w-8 text-zinc-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-3 py-1 text-xs font-semibold text-zinc-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next page"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 h-8 w-8 text-zinc-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;

