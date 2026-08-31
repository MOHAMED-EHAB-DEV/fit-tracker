import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import BodyComp from "@/lib/db/models/BodyComp";
import genAI, { flashModel } from "@/lib/gemini/client";
import { bodyCompAnalysisSchema } from "@/lib/gemini/schemas";
import { BODY_COMP_SYSTEM_PROMPT } from "@/lib/gemini/prompts";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Gemini API key is not configured." },
        { status: 503 }
      );
    }

    let weight: number | null = null;
    let notes = "";
    let measurementsRaw: string | null = null;
    let base64Photo: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      weight = formData.get("weight") ? Number(formData.get("weight")) : null;
      notes = (formData.get("notes") as string) || "";
      measurementsRaw = formData.get("measurements") as string | null;

      const file = formData.get("photo") as File | null;
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Photo = buffer.toString("base64");
      }
    } else {
      const body = await request.json();
      weight = body.weight ? Number(body.weight) : null;
      notes = body.notes || "";
      measurementsRaw = body.measurements ? JSON.stringify(body.measurements) : null;
      base64Photo = body.photoBase64 || null;
    }

    if (!base64Photo && !weight && !measurementsRaw) {
      return NextResponse.json(
        { success: false, error: "Please upload a photo or provide weight/measurements for AI estimation." },
        { status: 400 }
      );
    }

    await getDb();

    // Fetch user context for precise anthropometric analysis
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
      "--- PHYSIQUE BODY FAT & CONDITIONING ANALYSIS ---",
      `Biological Sex: ${sex}`,
      `Height: ${heightCm}`,
      `Age: ${age}`,
      `Current Goal: ${goal}`,
      `Current Body Weight: ${weight ? `${weight} kg` : (user?.fitnessProfile?.weightKg ? `${user.fitnessProfile.weightKg} kg` : "Not provided")}`,
      measurementsRaw ? `Body Circumferences: ${measurementsRaw}` : "",
      notes ? `User Notes: "${notes}"` : "User Notes: None provided.",
      prevContext,
      "",
      "Evaluation Directives:",
      "1. Objectively evaluate visible muscular development, subcutaneous fat levels, vascularity, and symmetry.",
      "2. Estimate a single precise body fat percentage ('estimatedBodyFatPercent') and a realistic 2% range ('estimatedBodyFatRange').",
      "3. Highlight standout muscle groups in 'muscleGroupHighlights'.",
      "4. Provide 3–4 practical recommendations for caloric phase, protein intake, and training focus in 'recommendations'.",
      "5. Summarize clinical observations in 'qualitativeNotes'.",
    ].filter(Boolean).join("\n");

    const contents: any[] = [];
    if (base64Photo) {
      contents.push({
        inlineData: {
          data: base64Photo,
          mimeType: "image/webp",
        },
      });
    }
    contents.push(promptText);

    const response = await genAI.models.generateContent({
      model: flashModel,
      contents,
      config: {
        systemInstruction: BODY_COMP_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: bodyCompAnalysisSchema as any,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini Flash model");
    }

    const cleaned = text.replace(/```json\s*|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    let estimatedBodyFatPercent = typeof parsed.estimatedBodyFatPercent === "number"
      ? Math.round(parsed.estimatedBodyFatPercent * 10) / 10
      : null;

    // Fallback: If numeric percent missing, extract midpoint from range e.g. "12.0% - 14.0%" -> 13.0
    if (estimatedBodyFatPercent === null && parsed.estimatedBodyFatRange) {
      const matches = parsed.estimatedBodyFatRange.match(/(\d+(\.\d+)?)/g);
      if (matches && matches.length >= 2) {
        const low = parseFloat(matches[0]);
        const high = parseFloat(matches[1]);
        estimatedBodyFatPercent = Math.round(((low + high) / 2) * 10) / 10;
      } else if (matches && matches.length === 1) {
        estimatedBodyFatPercent = parseFloat(matches[0]);
      }
    }

    const analysis = {
      estimatedBodyFatPercent,
      estimatedBodyFatRange: parsed.estimatedBodyFatRange || (estimatedBodyFatPercent ? `${estimatedBodyFatPercent}%` : ""),
      qualitativeNotes: parsed.qualitativeNotes || "",
      comparedToPrevious: parsed.comparedToPrevious || "",
      muscleGroupHighlights: Array.isArray(parsed.muscleGroupHighlights) ? parsed.muscleGroupHighlights : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      modelUsed: flashModel,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, analysis });
  } catch (err: any) {
    console.error("AI Body Comp estimation error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to estimate body fat with AI" },
      { status: 500 }
    );
  }
}
