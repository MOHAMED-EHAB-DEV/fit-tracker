/** Reads `{ success, error, ... }` from a response, tolerating non-JSON bodies (413, 504 pages). */
export async function readApiResponse<T extends Record<string, unknown>>(
  res: Response
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let data: (T & { success?: boolean; error?: string }) | null = null;
  try {
    data = (await res.json()) as T & { success?: boolean; error?: string };
  } catch {
    data = null;
  }
  if (res.ok && data && data.success) return { ok: true, data };
  if (data?.error && typeof data.error === "string") return { ok: false, error: data.error };
  if (res.status === 401) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (res.status === 413) return { ok: false, error: "That request is too large." };
  if (res.status === 429) return { ok: false, error: "Too many requests. Please wait a moment and try again." };
  if (res.status === 504 || res.status === 408) return { ok: false, error: "The server took too long to respond. Please try again." };
  return { ok: false, error: `Request failed (${res.status || "network error"}). Please try again.` };
}
