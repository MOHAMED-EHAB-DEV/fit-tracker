import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import cloudinary from "@/lib/cloudinary";
import genAI, { flashModel, createGeminiConfig } from "@/lib/gemini/client";
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

    // 2. Handle Multipart Form Data (Photo / description analysis)
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const description = (formData.get("description") as string) || "";
    const mealType = ((formData.get("mealType") as string) || "lunch") as MealType;
    const dateStringParam = (formData.get("dateString") as string) || null;
    const shouldSaveImmediately = formData.get("save") === "true";

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
    }

    // Call Gemini for structured nutritional estimation
    let analysis = {
      mealDescription: description || "Logged meal",
      items: [] as any[],
      totals: { calories: 450, protein: 30, carbs: 45, fat: 15, fiber: 5 },
      confidence: "medium" as const,
      confidenceReason: "Standard dish with estimated portion scale and seasoning.",
      geminiNotes: "",
    };

    if (process.env.GEMINI_API_KEY) {
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

        const promptText = [
          `Target Meal Category: ${mealType}`,
          description.trim()
            ? `User Provided Notes / Ingredients: "${description.trim()}"`
            : `User Provided Notes: None (Perform visual plate analysis).`,
          `Input Modality: ${base64Image ? "Photo + text description" : "Text description only"}.`,
          "",
          "Evaluation Protocol:",
          "1. Deconstruct every visible or described food item into specific ingredients (proteins, carbs, fats, vegetables, dairy, sauces, cooking oils).",
          "2. Estimate realistic portion sizes using metric units (grams 'g' or milliliters 'ml') and specify cooked vs raw state.",
          "3. Account for cooking fats (e.g., 5g–10g oil/butter for pan-searing or roasting) unless explicitly oil-free.",
          "4. Calculate scientific macronutrients (Calories, Protein, Carbs, Fat, Fiber) per ingredient using USDA nutritional standards.",
          "5. If the user provided explicit weights or ingredients in their description, prioritize them over visual guesses.",
          "6. Ensure strict mathematical sum consistency: totals MUST equal the sum of all individual items.",
          "7. Specify accurate confidence rating ('high', 'medium', or 'low') and provide a clear 'confidenceReason' explaining visibility, lighting, ingredients, and portion certainty.",
          "8. Provide a concise, professional dietitian note in 'geminiNotes' summarizing key assumptions (cooking oils, sauces) and nutritional balance.",
        ].join("\n");
        contents.push(promptText);

        const response = await genAI.models.generateContent({
          model: flashModel,
          contents,
          config: createGeminiConfig({
            systemInstruction: MEAL_ANALYZER_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: mealAnalysisSchema as any,
            maxOutputTokens: 2048,
          }),
        });

        const text = response.text;
        if (text) {
          const cleanedText = text.replace(/```json\s*|```/g, "").trim();
          const parsed = JSON.parse(cleanedText);
          if (parsed && typeof parsed === "object") {
            const items = Array.isArray(parsed.items) ? parsed.items : [];
            let { calories = 0, protein = 0, carbs = 0, fat = 0, fiber = 0 } = parsed.totals || {};

            // If totals are missing or 0 while items exist, sum up from items
            if ((!calories || calories <= 0) && items.length > 0) {
              calories = items.reduce((sum: number, it: any) => sum + (Number(it.calories) || 0), 0);
              protein = items.reduce((sum: number, it: any) => sum + (Number(it.protein) || 0), 0);
              carbs = items.reduce((sum: number, it: any) => sum + (Number(it.carbs) || 0), 0);
              fat = items.reduce((sum: number, it: any) => sum + (Number(it.fat) || 0), 0);
              fiber = items.reduce((sum: number, it: any) => sum + (Number(it.fiber) || 0), 0);
            }

            analysis = {
              mealDescription: parsed.mealDescription || description || "Logged Meal",
              items,
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
            };
          }
        }
      } catch (geminiErr) {
        console.error("Gemini meal analysis error:", geminiErr);
      }
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
    const targetDateStr = dateStringParam || getTodayDateString();

    const meal = await Meal.create({
      userId: session.userId,
      loggedAt: new Date(),
      dateString: targetDateStr,
      mealType,
      description: analysis.mealDescription || description || "Logged Meal",
      imageSource: cloudinaryResult ? "photo" : "text_only",
      cloudinary: cloudinaryPayload,
      aiMacros: {
        calories: analysis.totals.calories,
        protein: analysis.totals.protein,
        carbs: analysis.totals.carbs,
        fat: analysis.totals.fat,
        fiber: analysis.totals.fiber || 0,
        confidence: analysis.confidence,
        confidenceReason: analysis.confidenceReason,
        geminiNotes: analysis.geminiNotes || "",
        modelUsed: flashModel,
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
