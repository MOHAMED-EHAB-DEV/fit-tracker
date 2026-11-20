import "server-only";
import { HttpError, badRequest } from "@/lib/api/errors";
import { readJson } from "@/lib/api/route";
import { formJson, formNumber, formText } from "@/lib/validation/body-comp";

/** Multipart bodies carry at most one resized photo plus a few fields. */
const MAX_MULTIPART_BYTES = 10 * 1024 * 1024;

export interface CheckInRequest {
  /** Unvalidated field values, ready for a zod schema. */
  fields: Record<string, unknown>;
  photo: File | null;
}

/**
 * Reads a check-in request: multipart/form-data (with an optional `photo`) or
 * JSON. Units are metric: `weightKg`, `bodyFatPercent`, `measurements` (cm).
 * The legacy names `weight` (kg) and `bodyFat` are still accepted.
 */
export async function readCheckInRequest(request: Request): Promise<CheckInRequest> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_MULTIPART_BYTES) throw new HttpError(413, "The upload is too large (max 8 MB photo).");
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw badRequest("Invalid form data");
    }
    const photoEntry = form.get("photo");
    const photo = photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
    const fields: Record<string, unknown> = {
      weightKg: formNumber(form.get("weightKg") ?? form.get("weight")),
      bodyFatPercent: formNumber(form.get("bodyFatPercent") ?? form.get("bodyFat")),
      measurements: formJson(form.get("measurements")),
      notes: formText(form.get("notes")),
      dateString: formText(form.get("dateString")) || undefined,
      aiAnalysis: formJson(form.get("aiAnalysis")),
    };
    return { fields, photo };
  }

  const json = await readJson(request);
  if (!json || typeof json !== "object" || Array.isArray(json)) throw badRequest("Invalid request body");
  const body = { ...(json as Record<string, unknown>) };
  if (body.weightKg === undefined && body.weight !== undefined) body.weightKg = body.weight;
  delete body.weight;
  if (body.bodyFatPercent === undefined && body.bodyFat !== undefined) body.bodyFatPercent = body.bodyFat;
  delete body.bodyFat;
  delete body.photoBase64;
  return { fields: body, photo: null };
}
