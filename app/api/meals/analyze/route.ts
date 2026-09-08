import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import User from "@/lib/db/models/User";
import cloudinary from "@/lib/cloudinary";
import genAI, {
  flashModel,
  fallbackFlashModel,
  createGeminiConfig,
  generateContentWithFallback,
} from "@/lib/gemini/client";
import { mealAnalysisSchema } from "@/lib/gemini/schemas";
import { MEAL_ANALYZER_SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { UploadApiResponse } from "cloudinary";
import { MealType } from "@/types/fitness";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    // 1. Handle JSON payload (Saving confirmed details from the confirmation modal)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const {
        description,
        mealType = "lunch",
        dateString,
        macros,
        aiMacros,
        items,
        cloudinary: cloudinaryData,
      } = body;

      if (!macros || typeof macros.calories === "undefined") {
        return NextResponse.json(
          { success: false, error: "Missing required macro fields" },
          { status: 400 }
        );
      }

      await getDb();
      const targetDateStr = dateString || getTodayDateString();

      const meal = await Meal.create({
        userId: session.userId,
        loggedAt: new Date(),
        dateString: targetDateStr,
        mealType,
        description: description || "Logged Meal",
        imageSource: cloudinaryData ? "photo" : "text_only",
        cloudinary: cloudinaryData || null,
        items: Array.isArray(items)
          ? items.map((it: any) => ({
              name: String(it.name || "Item"),
              quantity: String(it.quantity || ""),
              calories: Math.round(Number(it.calories) || 0),
              protein: Number((Number(it.protein) || 0).toFixed(1)),
              carbs: Number((Number(it.carbs) || 0).toFixed(1)),
              fat: Number((Number(it.fat) || 0).toFixed(1)),
              fiber: Number((Number(it.fiber) || 0).toFixed(1)),
            }))
          : [],
        aiMacros: aiMacros
          ? {
              calories: Number(aiMacros.calories) || Number(macros.calories) || 0,
              protein: Number(aiMacros.protein) || Number(macros.protein) || 0,
              carbs: Number(aiMacros.carbs) || Number(macros.carbs) || 0,
              fat: Number(aiMacros.fat) || Number(macros.fat) || 0,
              fiber: Number(aiMacros.fiber) || Number(macros.fiber) || 0,
              confidence: aiMacros.confidence || "medium",
              confidenceReason: aiMacros.confidenceReason || "",
              geminiNotes: aiMacros.geminiNotes || "",
              modelUsed: flashModel,
            }
          : null,
        macros: {
          calories: Math.round(Number(macros.calories) || 0),
          protein: Number((Number(macros.protein) || 0).toFixed(1)),
          carbs: Number((Number(macros.carbs) || 0).toFixed(1)),
          fat: Number((Number(macros.fat) || 0).toFixed(1)),
          fiber: Number((Number(macros.fiber) || 0).toFixed(1)),
        },
        isManualOverride: false,
      });

      // Update DailyLog totals atomically via $inc
      await DailyLog.findOneAndUpdate(
        { userId: session.userId, dateString: targetDateStr },
        {
          $inc: {
            caloriesIn: Math.round(Number(macros.calories) || 0),
            "macros.protein": Number((Number(macros.protein) || 0).toFixed(1)),
            "macros.carbs": Number((Number(macros.carbs) || 0).toFixed(1)),
            "macros.fat": Number((Number(macros.fat) || 0).toFixed(1)),
            "macros.fiber": Number((Number(macros.fiber) || 0).toFixed(1)),
          },
          $setOnInsert: {
            date: new Date(),
            waterMl: 0,
            steps: 0,
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        mealId: meal._id.toString(),
        meal,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const imageUrl = (formData.get("imageUrl") as string) || "";
    const description = (formData.get("description") as string) || "";
    const mealType = ((formData.get("mealType") as string) || "lunch") as MealType;
    const dateStringParam = (formData.get("dateString") as string) || null;
    const shouldSaveImmediately = formData.get("save") === "true";
    const previousItemsRaw = (formData.get("previousItems") as string) || "";
    const previousMacrosRaw = (formData.get("previousMacros") as string) || "";

    let previousItems: any[] = [];
    if (previousItemsRaw) {
      try {
        const parsed = JSON.parse(previousItemsRaw);
        if (Array.isArray(parsed)) previousItems = parsed;
      } catch {
        // ignore parse error
      }
    }

    let previousMacros: any = null;
    if (previousMacrosRaw) {
      try {
        previousMacros = JSON.parse(previousMacrosRaw);
      } catch {
        // ignore parse error
      }
    }

    let cloudinaryResult: UploadApiResponse | null = null;
    let base64Image: string | null = null;

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Image = buffer.toString("base64");

      // Server-side upload to Cloudinary using SDK singleton
      cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "fit-tracker/meals",
            resource_type: "image",
            format: "webp",
          },
          (error, result) => {
            if (error || !result) reject(error || new Error("Cloudinary upload failed"));
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
    } else if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          base64Image = Buffer.from(arrayBuffer).toString("base64");
        }
      } catch (e) {
        console.warn("Could not fetch existing imageUrl for re-analysis:", e);
      }
    }

    await getDb();
    const userDoc = await User.findById(session.userId).select("preferences.customGeminiApiKey").lean();
    const userApiKey = userDoc?.preferences?.customGeminiApiKey?.trim() || undefined;

    if (!userApiKey && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "No Gemini API Key configured. Add your free key in Settings." },
        { status: 500 }
      );
    }

    const targetDateStr = dateStringParam || getTodayDateString();

    // Call Gemini for structured nutritional estimation
    let analysis: {
      mealDescription: string;
      items: any[];
      totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      confidence: "high" | "medium" | "low";
      confidenceReason: string;
      geminiNotes: string;
      modelUsed: string;
    };

    try {
      const contents: any[] = [];

      if (base64Image) {
        contents.push({
          inlineData: {
            data: base64Image,
            mimeType: "image/webp",
          },
        });
      }

      const previousContextParts: string[] = [];
      if (previousItems.length > 0) {
        previousContextParts.push(
          "Previous / Existing Logged Ingredients & Individual Macros:",
          ...previousItems.map(
            (it, i) =>
              `  ${i + 1}. ${it.name || "Item"}${it.quantity ? ` (${it.quantity})` : ""}: ${it.calories ?? 0} kcal | ${it.protein ?? 0}g protein | ${it.carbs ?? 0}g carbs | ${it.fat ?? 0}g fat | ${it.fiber ?? 0}g fiber`
          )
        );
      }
      if (previousMacros) {
        previousContextParts.push(
          `Previous Total Macro Targets: ${previousMacros.calories || 0} kcal, ${previousMacros.protein || 0}g protein, ${previousMacros.carbs || 0}g carbs, ${previousMacros.fat || 0}g fat, ${previousMacros.fiber || 0}g fiber`
        );
      }
      if (previousContextParts.length > 0) {
        previousContextParts.push(
          "",
          "CRITICAL REGENERATION DIRECTIVE — PRESERVE AND COMBINE INGREDIENTS:",
          "1. The final 'items' array MUST contain ALL previous ingredients alongside any newly described or identified food items.",
          "2. Do NOT drop, replace, or wipe out previous ingredients unless the user explicitly requested to remove an item.",
          "3. For previous items: keep their name and portions/macros (or refine them if more detail is given in the prompt).",
          "4. For new items: append them as new entries with their respective portion and USDA macros in the 'items' array.",
          "5. 'totals' MUST be the exact mathematical sum of ALL items combined (retained previous items + new items)."
        );
      }

      const promptText = [
        `User Meal Context / Description: "${description || "(No description provided, analyze from image)"}"`,
        `Logged Date: ${targetDateStr}`,
        "",
        ...previousContextParts,
        "",
        "Instructions:",
        "1. Deconstruct every visible or described food item into specific ingredients (proteins, carbs, fats, vegetables, dairy, sauces, cooking oils).",
        "2. Estimate realistic portion sizes using metric units (grams 'g' or milliliters 'ml') and specify cooked vs raw state.",
        "3. Account for cooking fats (e.g., 5g–10g oil/butter for pan-searing or roasting) unless explicitly oil-free.",
        "4. Calculate scientific macronutrients (Calories, Protein, Carbs, Fat, Fiber) per ingredient using USDA nutritional standards.",
        "5. If the user provided explicit weights or ingredients in their description or previous ingredients list, prioritize and refine them over visual guesses.",
        "6. Ensure strict mathematical sum consistency: totals MUST equal the sum of all individual items.",
        "7. Specify accurate confidence rating ('high', 'medium', or 'low') and provide a clear 'confidenceReason' explaining visibility, lighting, ingredients, and portion certainty.",
        "8. Provide a concise, professional dietitian note in 'geminiNotes' summarizing key assumptions (cooking oils, sauces) and nutritional balance.",
      ].filter(Boolean).join("\n");
      contents.push(promptText);

      const { text, modelUsed } = await generateContentWithFallback({
        primaryModel: flashModel,
        fallbackModel: fallbackFlashModel,
        contents,
        apiKey: userApiKey,
        config: createGeminiConfig({
          systemInstruction: MEAL_ANALYZER_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: mealAnalysisSchema as any,
          maxOutputTokens: 2048,
        }),
      });

      if (!text) {
        throw new Error("No response received from Gemini AI.");
      }

      const cleanedText = text.replace(/```json\s*|```/g, "").trim();
      const parsed = JSON.parse(cleanedText);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON received from Gemini AI.");
      }

      const rawReturnedItems = Array.isArray(parsed.items) ? parsed.items : [];
      let finalItems = [...rawReturnedItems];

      // If previous items were supplied, verify none were dropped accidentally
      if (previousItems.length > 0) {
        const returnedNamesLower = rawReturnedItems.map((it: any) =>
          String(it.name || "").toLowerCase().trim()
        );

        const missingPreviousItems = previousItems.filter((prev: any) => {
          const prevNameLower = String(prev.name || "").toLowerCase().trim();
          if (!prevNameLower) return false;
          return !returnedNamesLower.some(
            (retName: string) => retName.includes(prevNameLower) || prevNameLower.includes(retName)
          );
        });

        if (missingPreviousItems.length > 0) {
          finalItems = [...missingPreviousItems, ...finalItems];
        }
      }

      let { calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0 } = parsed.totals || {};

      // If items exist, recalculate totals to reflect the complete set of items
      if (finalItems.length > 0) {
        calories = finalItems.reduce((sum: number, it: any) => sum + (Number(it.calories) || 0), 0);
        protein = finalItems.reduce((sum: number, it: any) => sum + (Number(it.protein) || 0), 0);
        carbs = finalItems.reduce((sum: number, it: any) => sum + (Number(it.carbs) || 0), 0);
        fat = finalItems.reduce((sum: number, it: any) => sum + (Number(it.fat) || 0), 0);
        fiber = finalItems.reduce((sum: number, it: any) => sum + (Number(it.fiber) || 0), 0);
      }

      analysis = {
        mealDescription: parsed.mealDescription || description || "Logged Meal",
        items: finalItems,
        totals: {
          calories: Math.round(Number(calories) || 0),
          protein: Number((Number(protein) || 0).toFixed(1)),
          carbs: Number((Number(carbs) || 0).toFixed(1)),
          fat: Number((Number(fat) || 0).toFixed(1)),
          fiber: Number((Number(fiber) || 0).toFixed(1)),
        },
        confidence: parsed.confidence || "medium",
        confidenceReason:
          parsed.confidenceReason ||
          (parsed.confidence === "high"
            ? "Clear visibility with distinct ingredients and standard scale."
            : parsed.confidence === "low"
            ? "Complex mixed dish or obscured ingredients requiring portion estimation."
            : "Standard dish with estimated cooking fats or sauces."),
        geminiNotes: parsed.geminiNotes || "",
        modelUsed,
      };
    } catch (geminiErr: any) {
      console.error("Gemini meal analysis error:", geminiErr);
      return NextResponse.json(
        { success: false, error: geminiErr.message || "Failed to analyze meal with AI." },
        { status: 500 }
      );
    }

    const cloudinaryPayload = cloudinaryResult
      ? {
          publicId: cloudinaryResult.public_id,
          secureUrl: cloudinaryResult.secure_url,
          deliveryType: "upload" as const,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          bytes: cloudinaryResult.bytes,
        }
      : null;

    // If immediate save is not requested (default flow for opening the confirmation modal)
    if (!shouldSaveImmediately) {
      return NextResponse.json({
        success: true,
        analysis,
        cloudinary: cloudinaryPayload,
      });
    }

    // Direct immediate save flow (if requested)
    await getDb();

    const meal = await Meal.create({
      userId: session.userId,
      loggedAt: new Date(),
      dateString: targetDateStr,
      mealType,
      description: analysis.mealDescription || description || "Logged Meal",
      imageSource: cloudinaryResult ? "photo" : "text_only",
      cloudinary: cloudinaryPayload,
      items: analysis.items || [],
      aiMacros: {
        calories: analysis.totals.calories,
        protein: analysis.totals.protein,
        carbs: analysis.totals.carbs,
        fat: analysis.totals.fat,
        fiber: analysis.totals.fiber || 0,
        confidence: analysis.confidence,
        confidenceReason: analysis.confidenceReason,
        geminiNotes: analysis.geminiNotes || "",
        modelUsed: analysis.modelUsed || flashModel,
      },
      macros: {
        calories: analysis.totals.calories,
        protein: analysis.totals.protein,
        carbs: analysis.totals.carbs,
        fat: analysis.totals.fat,
        fiber: analysis.totals.fiber || 0,
      },
      isManualOverride: false,
    });

    await DailyLog.findOneAndUpdate(
      { userId: session.userId, dateString: targetDateStr },
      {
        $inc: {
          caloriesIn: analysis.totals.calories,
          "macros.protein": analysis.totals.protein,
          "macros.carbs": analysis.totals.carbs,
          "macros.fat": analysis.totals.fat,
          "macros.fiber": analysis.totals.fiber || 0,
        },
        $setOnInsert: {
          date: new Date(),
          waterMl: 0,
          steps: 0,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      mealId: meal._id.toString(),
      analysis,
      meal,
      cloudinary: cloudinaryPayload,
    });
  } catch (err: any) {
    console.error("Meal analyze route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
