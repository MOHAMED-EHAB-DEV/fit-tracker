import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import BodyComp from "@/lib/db/models/BodyComp";
import User from "@/lib/db/models/User";
import cloudinary from "@/lib/cloudinary";
import genAI, { flashModel } from "@/lib/gemini/client";
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

    const formData = await request.formData();
    const weight = formData.get("weight") ? Number(formData.get("weight")) : null;
    const bodyFat = formData.get("bodyFat") ? Number(formData.get("bodyFat")) : null;
    const notes = (formData.get("notes") as string) || "";
    const measurementsRaw = formData.get("measurements") as string | null;

    let measurements = null;
    if (measurementsRaw) {
      try {
        measurements = JSON.parse(measurementsRaw);
      } catch (e) {
        console.error("Failed to parse measurements JSON:", e);
      }
    }

    const file = formData.get("photo") as File | null;
    const photos = [];
    let base64Photo: string | null = null;

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

    // Optional Gemini physique analysis
    let aiAnalysis = null;
    if (process.env.GEMINI_API_KEY && base64Photo) {
      try {
        const response = await genAI.models.generateContent({
          model: flashModel,
          contents: [
            {
              inlineData: {
                data: base64Photo,
                mimeType: "image/webp",
              },
            },
            `Evaluate this physique check-in photo. Weight: ${weight || "N/A"}kg. Notes: ${notes || "N/A"}. Provide bodybuilding & body composition feedback with accurate measurements and percentages up to one decimal point.`,
          ],
          config: {
            systemInstruction: BODY_COMP_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: bodyCompAnalysisSchema as any,
            maxOutputTokens: 2048,
          },
        });

        const text = response.text;
        if (text) {
          const cleaned = text.replace(/```json\s*|```/g, "").trim();
          aiAnalysis = {
            ...JSON.parse(cleaned),
            modelUsed: flashModel,
            generatedAt: new Date(),
          };
        }
      } catch (geminiErr) {
        console.error("Gemini body comp error:", geminiErr);
      }
    }

    await getDb();
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
