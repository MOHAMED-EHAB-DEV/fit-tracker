/**
 * Small fetch wrapper for the app's JSON API (browser only).
 * It always resolves to data or throws an ApiError with a message that is
 * safe to show — including when the server answers with something that is
 * not JSON (a gateway timeout page, for example).
 */
export class ApiError extends Error {
  status: number;
  details?: Record<string, unknown>;
  /** True when the request never reached the server. */
  offline: boolean;

  constructor(message: string, status: number, details?: Record<string, unknown>, offline = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.offline = offline;
  }
}

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Let the request finish even if the page is being hidden or closed. */
  keepalive?: boolean;
}

export async function api<T = Record<string, unknown>>(url: string, options: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      keepalive: options.keepalive,
      credentials: "same-origin",
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new ApiError("No connection. Check your internet and try again.", 0, undefined, true);
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  if (!response.ok || !payload || payload.success === false) {
    const message =
      (payload && typeof payload.error === "string" && payload.error) ||
      (response.status >= 500
        ? "Something went wrong on our side. Please try again."
        : "The request could not be completed.");
    throw new ApiError(message, response.status, (payload?.details as Record<string, unknown>) || undefined);
  }

  return payload as T;
}

/** A message for any thrown value, for toasts and inline errors. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  return fallback;
}
