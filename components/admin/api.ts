/** Client helpers for the admin API: every response is checked for `ok` and `success`. */

export class ApiError extends Error {
  status: number;
  details: Record<string, unknown> | null;

  constructor(status: number, message: string, details: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const FALLBACK: Record<number, string> = {
  401: "Your session has ended. Sign in again.",
  403: "You no longer have admin access.",
  404: "It no longer exists.",
  413: "The upload is too large.",
  429: "Too many requests. Wait a moment and try again.",
};

/** Parses a JSON API response; throws ApiError unless it is a success. */
export async function readApi<T>(response: Response): Promise<T & { success: true }> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const body = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (!response.ok || body.success !== true) {
    const message =
      typeof body.error === "string" && body.error
        ? body.error
        : FALLBACK[response.status] || `The server answered with an error (${response.status}). Try again.`;
    const details = body.details && typeof body.details === "object" ? (body.details as Record<string, unknown>) : null;
    throw new ApiError(response.status, message, details);
  }
  return body as T & { success: true };
}

/** fetch + readApi with a JSON body. Network failures become a readable ApiError. */
export async function apiRequest<T>(
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T & { success: true }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method || "GET",
      signal: init.signal,
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  return readApi<T>(response);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Try again.";
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
