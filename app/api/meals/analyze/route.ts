import { NextRequest } from "next/server";
import {
  HttpError,
  badRequest,
  enforceRateLimit,
  errorResponse,
  fail,
  notFound,
  ok,
  parseWith,
  readJson,
  unauthorized,
} from "@/lib/api/route";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  createGeminiConfig,
  formatAiErrorMessage,
  generateContentWithFallback,
} from "@/lib/gemini/client";
import { mealAnalysisSchema } from "@/lib/gemini/schemas";
import { MEAL_ANALYZER_SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import {
  MEAL_LIMITS,
  mealAnalyzeFieldsSchema,
  mealRegenerateSchema,
  type MealItemInput,
} from "@/lib/validation/nutrition";
import { AnalysisParseError, buildMealAnalysisPrompt, parseMealAnalysis } from "@/lib/nutrition/analysis";
import { proposalSecret, signProposalToken } from "@/lib/nutrition/proposal-token";
import { loadMealImageForAnalysis } from "@/lib/nutrition/images";
import { readMealPhotos } from "@/lib/nutrition/upload";

// AI calls can be slow; give the function room before the platform cuts it off.
export const maxDuration = 60;

interface InlineImage {
  data: string;
  mimeType: string;
}

/** HTTP status for an AI failure that is not one of our own HttpErrors. */
function aiFailureStatus(message: string): number {
  const lower = message.toLowerCase();
  if (lower.includes("limit")) return 429;
  if (lower.includes("not configured") || lower.includes("api key")) return 503;
  if (lower.includes("timed out")) return 504;
  return 502;
}

/**
 * Estimates a meal with AI and returns a PROPOSAL. Nothing is stored here:
 * photos go to the model only, and the user saves the reviewed meal through
 * POST /api/meals (new meal) or PATCH /api/meals/[id] (regenerate).
 *
 *  - multipart/form-data: "photos" (up to 4), "description", "mealType", "dateString".
 *  - JSON { mealId, description, currentItems }: re-analyze a saved meal; its stored
 *    photos are loaded by the server (the user's own meal only).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) throw unauthorized();

    const contentType = request.headers.get("content-type") || "";
    const images: InlineImage[] = [];
    const warnings: string[] = [];
    let description = "";
    let mealType: string | undefined;
    let dateString: string | undefined;
    let currentItems: MealItemInput[] = [];

    if (contentType.includes("multipart/form-data")) {
      const declared = Number(request.headers.get("content-length") || 0);
      if (declared > MEAL_LIMITS.requestBytesMax) {
        throw new HttpError(413, "The photos are too large. Use fewer or smaller photos.");
      }
      const form = await request.formData();
      const fields = parseWith(mealAnalyzeFieldsSchema, {
        description: typeof form.get("description") === "string" ? form.get("description") : undefined,
        mealType: typeof form.get("mealType") === "string" && form.get("mealType") ? form.get("mealType") : undefined,
        dateString: typeof form.get("dateString") === "string" && form.get("dateString") ? form.get("dateString") : undefined,
      });
      description = fields.description;
      mealType = fields.mealType;
      dateString = fields.dateString;

      const photos = await readMealPhotos(form, "photos");
      if (photos.length > 0) await enforceRateLimit(RATE_LIMITS.uploadPerHour, session.userId);
      for (const photo of photos) images.push({ data: photo.buffer.toString("base64"), mimeType: photo.mimeType });
    } else if (contentType.includes("application/json")) {
      const body = parseWith(mealRegenerateSchema, await readJson(request, 64 * 1024));
      await getDb();
      const meal = await Meal.findOne({ _id: body.mealId, userId: session.userId })
        .select("images mealType dateString")
        .lean();
      if (!meal) throw notFound("Meal not found");

      description = body.description;
      mealType = body.mealType || meal.mealType;
      dateString = meal.dateString;
      currentItems = body.currentItems;

      const stored = (meal.images || []).slice(0, MEAL_LIMITS.photosMax);
      if (stored.length > 0) await enforceRateLimit(RATE_LIMITS.uploadPerHour, session.userId);
      const loaded = await Promise.allSettled(stored.map((image) => loadMealImageForAnalysis(session.userId, image)));
      let missing = 0;
      for (const result of loaded) {
        if (result.status === "fulfilled") images.push(result.value);
        else {
          missing++;
          console.warn("[meals/analyze] stored photo could not be loaded:", result.reason);
        }
      }
      if (missing > 0) {
        if (images.length === 0 && !description && currentItems.length === 0) {
          throw new HttpError(502, "The meal's photo could not be loaded. Add a description and try again.");
        }
        warnings.push(
          missing === stored.length
            ? "The saved photo could not be loaded, so the AI used only the text and ingredients."
            : `${missing} of the saved photos could not be loaded and were not analyzed.`
        );
      }
    } else {
      throw new HttpError(415, "Unsupported request format");
    }

    if (images.length === 0 && !description && currentItems.length === 0) {
      throw badRequest("Add a photo or describe the meal first.");
    }

    const prompt = buildMealAnalysisPrompt({
      description,
      mealType,
      dateString,
      photoCount: images.length,
      currentItems,
    });

    let text: string | undefined;
    let modelUsed: string;
    try {
      const result = await generateContentWithFallback({
        userId: session.userId,
        task: "fast",
        contents: [...images.map((image) => ({ inlineData: image })), prompt],
        config: createGeminiConfig({
          systemInstruction: MEAL_ANALYZER_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: mealAnalysisSchema,
          maxOutputTokens: 4096,
          temperature: 0.2,
        }),
      });
      text = result.text;
      modelUsed = result.modelUsed;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      console.error("[meals/analyze] AI call failed:", err);
      const message = formatAiErrorMessage(err);
      return fail(aiFailureStatus(message), message);
    }

    let parsed;
    try {
      parsed = parseMealAnalysis(text, { currentItemCount: currentItems.length, fallbackDescription: description });
    } catch (err) {
      if (err instanceof AnalysisParseError) return fail(502, `${err.message} Please try again.`);
      throw err;
    }

    const { proposal } = parsed;
    const proposalToken = signProposalToken(
      session.userId,
      {
        ...proposal.totals,
        confidence: proposal.confidence,
        confidenceReason: proposal.confidenceReason,
        geminiNotes: proposal.geminiNotes,
        modelUsed,
      },
      proposalSecret()
    );

    return ok({
      proposal,
      proposalToken,
      warnings: [...warnings, ...parsed.warnings],
      photosAnalyzed: images.length,
      modelUsed,
    });
  } catch (err) {
    return errorResponse(err, "POST /api/meals/analyze");
  }
}
