import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import BodyComp from "@/lib/db/models/BodyComp";
import User from "@/lib/db/models/User";
import cloudinary from "@/lib/cloudinary";
import genAI, { flashModel, createGeminiConfig } from "@/lib/gemini/client";
import { bodyCompAnalysisSchema } from "@/lib/gemini/schemas";
import { BODY_COMP_SYSTEM_PROMPT } from "@/lib/gemini/prompts";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();
    const checkIns = await BodyComp.find({ userId: session.userId })
      .sort({ checkInDate: -1 })
      .lean();

    return NextResponse.json({ success: true, checkIns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let weight: number | null = null;
    let bodyFat: number | null = null;
    let notes = "";
    let measurements: any = null;
    const photos = [];
    let base64Photo: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      weight = formData.get("weight") ? Number(formData.get("weight")) : null;
      bodyFat = formData.get("bodyFat") ? Number(formData.get("bodyFat")) : null;
      notes = (formData.get("notes") as string) || "";
      const measurementsRaw = formData.get("measurements") as string | null;

      if (measurementsRaw) {
        try {
          measurements = JSON.parse(measurementsRaw);
        } catch (e) {
          console.error("Failed to parse measurements JSON:", e);
        }
      }

      const file = formData.get("photo") as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Photo = buffer.toString("base64");

        const uploadResult = await new Promise<any>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "fit-tracker/body-comp",
              type: "private", // Private delivery for body check-in photos
              resource_type: "image",
              format: "webp",
            },
            (err, result) => (err || !result ? reject(err) : resolve(result))
          );
          stream.end(buffer);
        });

        photos.push({
          cloudinaryPublicId: uploadResult.public_id,
          angle: "front" as const,
          signedUrl: uploadResult.secure_url,
          urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
    } else {
      const body = await request.json();
      weight = body.weight ? Number(body.weight) : null;
      bodyFat = body.bodyFatPercent ? Number(body.bodyFatPercent) : null;
      notes = body.notes || "";
      measurements = body.measurements || null;
    }

    await getDb();

    // AI physique analysis using Gemini Flash model
    let aiAnalysis = null;
    if (process.env.GEMINI_API_KEY && base64Photo) {
      try {
        const user = await User.findById(session.userId)
          .select("fitnessProfile")
          .lean();

        const previousCheckIn = await BodyComp.findOne({ userId: session.userId })
          .sort({ checkInDate: -1 })
          .lean();

        const sex = user?.fitnessProfile?.sex || "Unspecified";
        const heightCm = user?.fitnessProfile?.heightCm ? `${user.fitnessProfile.heightCm} cm` : "Not provided";
        const age = user?.fitnessProfile?.age ? `${user.fitnessProfile.age} years old` : "Not provided";
        const goal = user?.fitnessProfile?.goal || "Not specified";

        const prevContext = previousCheckIn
          ? `Previous Check-in: Weight ${previousCheckIn.weight ? `${previousCheckIn.weight}kg` : "N/A"}, Body Fat: ${previousCheckIn.bodyFatPercent ? `${previousCheckIn.bodyFatPercent}%` : (previousCheckIn.aiAnalysis?.estimatedBodyFatRange || "N/A")}`
          : "Previous Check-in: None (First check-in)";

        const promptText = [
          "--- PHYSIQUE CHECK-IN EVALUATION & BODY FAT ESTIMATION ---",
          `Biological Sex: ${sex}`,
          `Height: ${heightCm}`,
          `Age: ${age}`,
          `Goal: ${goal}`,
          `Current Body Weight: ${weight ? `${weight} kg` : "Not provided"}`,
          notes ? `User Check-in Notes: "${notes}"` : "User Check-in Notes: None provided.",
          measurements ? `Body Circumferences: ${JSON.stringify(measurements)}` : "",
          prevContext,
          "",
          "Evaluation Directives:",
          "1. Objectively analyze visible muscular development, symmetry, and conditioning.",
          "2. Estimate a precise single-value body fat percentage ('estimatedBodyFatPercent') and a realistic 2% range ('estimatedBodyFatRange') based on anatomical landmarks (ab definition, vascularity, waist-to-shoulder taper, subcutaneous fat).",
          "3. Highlight standout muscle groups in 'muscleGroupHighlights'.",
          "4. Deliver 3–4 practical, actionable recommendations for nutrition phase and progressive training in 'recommendations'.",
        ].filter(Boolean).join("\n");

        const response = await genAI.models.generateContent({
          model: flashModel,
          contents: [
            {
              inlineData: {
                data: base64Photo,
                mimeType: "image/webp",
              },
            },
            promptText,
          ],
          config: createGeminiConfig({
            systemInstruction: BODY_COMP_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: bodyCompAnalysisSchema as any,
            maxOutputTokens: 2048,
          }),
        });

        const text = response.text;
        if (text) {
          const cleaned = text.replace(/```json\s*|```/g, "").trim();
          const parsed = JSON.parse(cleaned);

          let estimatedBfPercent = typeof parsed.estimatedBodyFatPercent === "number"
            ? Math.round(parsed.estimatedBodyFatPercent * 10) / 10
            : null;

          if (estimatedBfPercent === null && parsed.estimatedBodyFatRange) {
            const matches = parsed.estimatedBodyFatRange.match(/(\d+(\.\d+)?)/g);
            if (matches && matches.length >= 2) {
              const low = parseFloat(matches[0]);
              const high = parseFloat(matches[1]);
              estimatedBfPercent = Math.round(((low + high) / 2) * 10) / 10;
            } else if (matches && matches.length === 1) {
              estimatedBfPercent = parseFloat(matches[0]);
            }
          }

          aiAnalysis = {
            qualitativeNotes: parsed.qualitativeNotes || "",
            estimatedBodyFatPercent: estimatedBfPercent,
            estimatedBodyFatRange: parsed.estimatedBodyFatRange || (estimatedBfPercent ? `${estimatedBfPercent}%` : ""),
            comparedToPrevious: parsed.comparedToPrevious || "",
            muscleGroupHighlights: Array.isArray(parsed.muscleGroupHighlights) ? parsed.muscleGroupHighlights : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            modelUsed: flashModel,
            generatedAt: new Date(),
          };

          // Automatically populate bodyFat from AI estimate if not manually set
          if (bodyFat === null && estimatedBfPercent !== null) {
            bodyFat = estimatedBfPercent;
          }
        }
      } catch (geminiErr) {
        console.error("Gemini body comp error:", geminiErr);
      }
    }

    const todayStr = getTodayDateString();

    const checkIn = await BodyComp.create({
      userId: session.userId,
      checkInDate: new Date(),
      dateString: todayStr,
      weight,
      bodyFatPercent: bodyFat,
      measurements,
      photos,
      aiAnalysis,
      notes,
    });

    if (weight) {
      await User.updateOne(
        { _id: session.userId },
        { $set: { "fitnessProfile.weightKg": weight } }
      );
    }

    return NextResponse.json({ success: true, checkIn }, { status: 201 });
  } catch (err: any) {
    console.error("Body comp check-in error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
