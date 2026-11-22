"use client";

import React from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
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
  searchLabel?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  caption?: string;
}

function sortIcon(active: boolean, dir: "asc" | "desc" | undefined) {
  if (!active) return <ChevronsUpDown className="w-3.5 h-3.5 text-ink-3" aria-hidden="true" />;
  return dir === "asc" ? (
    <ChevronUp className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
  );
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
  searchLabel = "Search",
  isLoading = false,
  error = null,
  onRetry,
  actions,
  emptyMessage = "No records found",
  caption,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const colSpan = columns.length + (actions ? 1 : 0);

  const sortHeader = (col: Column<T>) => {
    const active = sortField === col.key;
    const nextDir = active && sortDir === "asc" ? "desc" : "asc";
    return (
      <button
        type="button"
        onClick={() => onSort?.(col.key, nextDir)}
        className="inline-flex items-center gap-1.5 min-h-11 cursor-pointer hover:text-ink rounded"
      >
        {col.label}
        {sortIcon(active, sortDir)}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {onSearchChange && (
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          maxLength={100}
          startContent={<Search className="w-4 h-4" />}
        />
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-3 rounded-control bg-surface border border-line text-sm text-danger">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-48">{error}</span>
          {onRetry && (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry} className="min-h-11">
              Try again
            </Button>
          )}
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-card border border-line bg-canvas">
        <table className="w-full text-sm" aria-busy={isLoading}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line bg-surface">
              {columns.map((col) => {
                const sortable = Boolean(col.sortable && onSort);
                const ariaSort = sortable
                  ? sortField === col.key
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={cn(
                      "px-4 py-2 text-left text-xs font-semibold text-ink-2 whitespace-nowrap",
                      col.className
                    )}
                  >
                    {sortable ? sortHeader(col) : col.label}
                  </th>
                );
              })}
              {actions && (
                <th
                  scope="col"
                  className="sticky right-0 bg-surface px-4 py-2 text-right text-xs font-semibold text-ink-2"
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading && data.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line">
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="h-4 bg-elevated rounded-chip animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-ink-2 text-sm font-medium">
                  {error ? "The list could not be loaded." : emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={String(row[keyField])}
                  className={cn(
                    "border-b border-line hover:bg-elevated transition-colors",
                    isLoading && "opacity-60"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 text-ink-2", col.className)}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td className="sticky right-0 bg-canvas px-2 py-2 text-right whitespace-nowrap">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(totalPages > 1 || page > 1) && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-ink-2 px-1">
          <span className="tabular-nums">
            {total === 0
              ? "No results"
              : `${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} of ${total.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Previous page"
              onClick={() => onPageChange(Math.min(page - 1, totalPages))}
              disabled={page <= 1}
              className="h-11 w-11 p-0 text-ink-2 hover:text-ink"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <span className="px-2 text-xs font-semibold text-ink-2 tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Next page"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="h-11 w-11 p-0 text-ink-2 hover:text-ink"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

export default DataTable;
