import type { MealPayload } from "@/lib/nutrition/draft";
import type { AnalyzeResponse, MealData } from "@/lib/nutrition/types";

/**
 * Browser-side calls to the meal API. Every helper checks both the HTTP status
 * and the JSON `success` flag and throws an Error with a message that is safe
 * to show (including for non-JSON gateway errors such as 413 or 504).
 */

function statusMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 413) return "The photos are too large. Use fewer or smaller photos.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status === 504 || status === 408) return "The request took too long. Please try again.";
  if (status >= 500) return "The server had a problem. Please try again.";
  return "The request failed. Please try again.";
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(statusMessage(response.status));
  }
  const body = data as { success?: boolean; error?: string } | null;
  if (!response.ok || !body || body.success !== true) {
    throw new Error(body?.error || statusMessage(response.status));
  }
  return data as T;
}

async function send<T>(input: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new Error("You appear to be offline. Check your connection and try again.");
  }
  return readApiResponse<T>(response);
}

const photoFileName = (blob: Blob, index: number) => {
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
  return `meal-${index + 1}.${ext}`;
};

/** Saves a new meal. Photos (if any) are uploaded together with it. */
export async function createMealRequest(
  payload: MealPayload,
  options: { photos?: Blob[]; aiProposal?: string | null } = {}
): Promise<MealData> {
  const body = options.aiProposal ? { ...payload, aiProposal: options.aiProposal } : payload;
  const photos = options.photos || [];
  if (photos.length === 0) {
    const data = await send<{ meal: MealData }>("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return data.meal;
  }
  const form = new FormData();
  form.append("meal", JSON.stringify(body));
  photos.forEach((blob, index) => form.append("photos", blob, photoFileName(blob, index)));
  const data = await send<{ meal: MealData }>("/api/meals", { method: "POST", body: form });
  return data.meal;
}

export async function updateMealRequest(
  mealId: string,
  payload: MealPayload,
  options: { aiProposal?: string | null } = {}
): Promise<MealData> {
  const body = options.aiProposal ? { ...payload, aiProposal: options.aiProposal } : payload;
  const data = await send<{ meal: MealData }>(`/api/meals/${encodeURIComponent(mealId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return data.meal;
}

/** Analyzes new photos and/or a description. Nothing is stored. */
export async function analyzePhotosRequest(
  input: { photos: Blob[]; description: string; mealType: string; dateString: string },
  signal?: AbortSignal
): Promise<AnalyzeResponse> {
  const form = new FormData();
  input.photos.forEach((blob, index) => form.append("photos", blob, photoFileName(blob, index)));
  form.append("description", input.description);
  form.append("mealType", input.mealType);
  form.append("dateString", input.dateString);
  return send<AnalyzeResponse>("/api/meals/analyze", { method: "POST", body: form, signal });
}

/** Re-analyzes a saved meal; the server loads the meal's own photos. */
export async function regenerateMealRequest(
  input: { mealId: string; description: string; mealType: string; currentItems: MealPayload["items"] },
  signal?: AbortSignal
): Promise<AnalyzeResponse> {
  return send<AnalyzeResponse>("/api/meals/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
}
