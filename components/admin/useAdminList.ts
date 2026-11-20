"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, errorMessage, isAbort } from "@/components/admin/api";

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ListState<T> {
  rows: T[];
  pagination: Pagination;
  isLoading: boolean;
  error: string | null;
  /** The rest of the last response (counts and other extras). */
  meta: Record<string, unknown>;
}

/**
 * Server-paginated list for the admin tables: debounced, aborts stale
 * requests (a slow older response never overwrites a newer one), surfaces
 * errors, and steps back a page when the current one becomes empty.
 */
export function useAdminList<T>(
  endpoint: string,
  itemsKey: string,
  params: Record<string, string>,
  pageSize: number,
  debounceMs: number = 300
) {
  const paramsKey = new URLSearchParams(params).toString();
  // The page resets to 1 whenever the filters change.
  const [pageState, setPageState] = useState({ key: paramsKey, page: 1 });
  const page = pageState.key === paramsKey ? pageState.page : 1;
  const setPage = useCallback((next: number) => setPageState({ key: paramsKey, page: next }), [paramsKey]);

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const [state, setState] = useState<ListState<T>>({
    rows: [],
    pagination: { total: 0, page: 1, limit: pageSize, totalPages: 1 },
    isLoading: true,
    error: null,
    meta: {},
  });

  useEffect(() => {
    // A flag, not an AbortController: a superseded request is ignored, never aborted.
    let stale = false;
    const query = new URLSearchParams(paramsKey);
    query.set("page", String(page));
    query.set("limit", String(pageSize));

    const timer = setTimeout(async () => {
      setState((current) => ({ ...current, isLoading: true, error: null }));
      try {
        const data = await apiRequest<Record<string, unknown> & { pagination: Pagination }>(`${endpoint}?${query}`);
        if (stale) return;
        const rows = (Array.isArray(data[itemsKey]) ? data[itemsKey] : []) as T[];
        if (rows.length === 0 && page > 1 && data.pagination.total > 0) {
          // The page emptied (e.g. after a delete): show the last page that has rows.
          setPageState({ key: paramsKey, page: Math.max(1, data.pagination.totalPages) });
          return;
        }
        setState({ rows, pagination: data.pagination, isLoading: false, error: null, meta: data });
      } catch (err) {
        if (stale || isAbort(err)) return;
        setState((current) => ({ ...current, isLoading: false, error: errorMessage(err) }));
      }
    }, reloadToken === 0 ? debounceMs : 0);

    return () => {
      clearTimeout(timer);
      stale = true;
    };
  }, [endpoint, itemsKey, paramsKey, page, pageSize, reloadToken, debounceMs]);

  return { ...state, page, setPage, reload };
}
