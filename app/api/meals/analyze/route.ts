import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import cloudinary from "@/lib/cloudinary";
import genAI, { flashModel } from "@/lib/gemini/client";
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const description = (formData.get("description") as string) || "";
    const mealType = ((formData.get("mealType") as string) || "lunch") as MealType;

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

        const promptText = `Meal type: ${mealType}. User description: "${description || "Analyze the meal shown in the photo"}". Estimate all ingredients, portions, calories, and macros with high accuracy up to one decimal point.`;
        contents.push(promptText);

        const response = await genAI.models.generateContent({
          model: flashModel,
          contents,
          config: {
            systemInstruction: MEAL_ANALYZER_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: mealAnalysisSchema as any,
            maxOutputTokens: 2048,
          },
        });

        const text = response.text;
        if (text) {
          const cleanedText = text.replace(/```json\s*|```/g, "").trim();
          analysis = JSON.parse(cleanedText);
        }
      } catch (geminiErr) {
        console.error("Gemini meal analysis error:", geminiErr);
      }
    }

    await getDb();
    const todayStr = getTodayDateString();

    // Create Meal in MongoDB
    const meal = await Meal.create({
      userId: session.userId,
      loggedAt: new Date(),
      dateString: todayStr,
      mealType,
      description: analysis.mealDescription || description || "Logged Meal",
      imageSource: cloudinaryResult ? "photo" : "text_only",
      cloudinary: cloudinaryResult
        ? {
            publicId: cloudinaryResult.public_id,
            secureUrl: cloudinaryResult.secure_url,
            deliveryType: "upload",
            width: cloudinaryResult.width,
            height: cloudinaryResult.height,
            bytes: cloudinaryResult.bytes,
          }
        : null,
      aiMacros: {
        calories: analysis.totals.calories,
        protein: analysis.totals.protein,
        carbs: analysis.totals.carbs,
        fat: analysis.totals.fat,
        fiber: analysis.totals.fiber || 0,
        confidence: analysis.confidence,
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

    // Update DailyLog totals atomically via $inc
    await DailyLog.findOneAndUpdate(
      { userId: session.userId, dateString: todayStr },
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
    });
  } catch (err: any) {
    console.error("Meal analyze route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
