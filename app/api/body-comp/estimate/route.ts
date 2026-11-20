import { NextRequest } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { HttpError, badRequest, errorResponse, fail, ok, parseWith, unauthorized } from "@/lib/api/route";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import {
  createGeminiConfig,
  formatAiErrorMessage,
  generateContentWithFallback,
} from "@/lib/gemini/client";
import { bodyCompAnalysisSchema } from "@/lib/gemini/schemas";
import { BODY_COMP_SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { estimateFieldsSchema } from "@/lib/validation/body-comp";
import { readCheckInRequest } from "@/lib/body-comp/form";
import { validatePhotoFile } from "@/lib/body-comp/photos";
import { recentCheckInsForPrompt } from "@/lib/body-comp/service";
import { buildEstimatePrompt } from "@/lib/body-comp/prompt";
import { AnalysisParseError, parseAnalysisText } from "@/lib/body-comp/analysis";
import type { AnalysisPreviewDTO } from "@/lib/body-comp/dto";

// AI calls can be slow; give the function room before the platform cuts it off.
export const maxDuration = 60;

/**
 * POST /api/body-comp/estimate — runs the AI estimate and returns it as a
 * proposal. Nothing is saved; the client attaches the proposal to the
 * check-in only if the user saves it.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) throw unauthorized();

    const { fields, photo } = await readCheckInRequest(request);
    const input = parseWith(estimateFieldsSchema, {
      weightKg: fields.weightKg,
      measurements: fields.measurements,
      notes: fields.notes,
    });
    const hasMeasurements = Boolean(input.measurements && Object.values(input.measurements).some((v) => v != null));
    if (!photo && !hasMeasurements) {
      throw badRequest("Add a photo or at least one measurement for an AI estimate.");
    }

    let validatedPhoto = null;
    if (photo) {
      await enforceRateLimit(RATE_LIMITS.uploadPerHour, session.userId);
      validatedPhoto = await validatePhotoFile(photo);
    }

    await getDb();
    const [user, history] = await Promise.all([
      User.findById(session.userId).select("fitnessProfile").lean(),
      recentCheckInsForPrompt(session.userId),
    ]);
    const profile = user?.fitnessProfile;
    const promptText = buildEstimatePrompt({
      profile: {
        sex: profile?.sex ?? null,
        heightCm: profile?.heightCm ?? null,
        age: profile?.age ?? null,
        goal: profile?.goal ?? null,
        profileWeightKg: profile?.weightKg ?? null,
      },
      weightKg: input.weightKg ?? null,
      measurementsCm: input.measurements ?? null,
      notes: input.notes || "",
      history,
      hasPhoto: Boolean(validatedPhoto),
    });

    const contents: unknown[] = [];
    if (validatedPhoto) {
      contents.push({
        inlineData: { data: validatedPhoto.buffer.toString("base64"), mimeType: validatedPhoto.mimeType },
      });
    }
    contents.push(promptText);

    let text: string | undefined;
    let modelUsed: string;
    try {
      const result = await generateContentWithFallback({
        userId: session.userId,
        task: "bodyComp",
        contents,
        config: createGeminiConfig({
          systemInstruction: BODY_COMP_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: bodyCompAnalysisSchema,
          maxOutputTokens: 2048,
        }),
      });
      text = result.text;
      modelUsed = result.modelUsed;
    } catch (aiErr) {
      if (aiErr instanceof HttpError) throw aiErr;
      console.error("[body-comp/estimate] AI call failed", aiErr);
      return fail(502, formatAiErrorMessage(aiErr));
    }

    let proposal;
    try {
      proposal = parseAnalysisText(text);
    } catch (parseErr) {
      if (parseErr instanceof AnalysisParseError) return fail(502, parseErr.message);
      throw parseErr;
    }

    const analysis: AnalysisPreviewDTO = { ...proposal, modelUsed, generatedAt: new Date().toISOString() };
    return ok({ analysis });
  } catch (err) {
    return errorResponse(err, "POST /api/body-comp/estimate");
  }
}
