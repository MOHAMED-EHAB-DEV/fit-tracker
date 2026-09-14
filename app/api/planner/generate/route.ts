import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";
import Workout from "@/lib/db/models/Workout";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import User from "@/lib/db/models/User";
import {
  generateContentWithFallback,
  createGeminiConfig,
  flashModel,
} from "@/lib/gemini/client";
import {
  PLANNER_SYSTEM_INSTRUCTION,
  buildPlannerUserPrompt,
} from "@/lib/gemini/planner-prompt";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { format, parseISO } from "date-fns";
import { sortEventsByPlannerTime } from "@/lib/planner/time-sort";

const plannerGenerationSchema = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Brief motivating summary of the day's strategy and focus",
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          startTime: { type: "string", description: "HH:mm format (24h)" },
          endTime: { type: "string", description: "HH:mm format (24h)" },
          category: {
            type: "string",
            enum: ["workout", "nutrition", "habit", "recovery", "focus", "other"],
          },
          color: { type: "string" },
          linkedHabitIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["title", "description", "startTime", "category", "color"],
      },
    },
  },
  required: ["summary", "events"],
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetDate = body.date || getTodayDateString();
    const userNotes = body.notes || "";

    await getDb();

    // Fetch user context
    const [user, habits, recentWorkouts, nutritionPlan] = await Promise.all([
      User.findById(session.userId).select("goals profile").lean(),
      Habit.find({ userId: session.userId, isActive: true }).select("_id name emoji color").lean(),
      Workout.find({ userId: session.userId }).sort({ date: -1 }).limit(3).select("name type").lean(),
      NutritionPlan.findOne({ userId: session.userId, isActive: true }).lean(),
    ]);

    const parsedDate = parseISO(targetDate);
    const dayName = format(parsedDate, "EEEE");

    const promptContext = {
      date: targetDate,
      dayName,
      habits: habits.map((h) => ({
        id: h._id.toString(),
        name: h.name,
        emoji: h.emoji,
        color: h.color,
      })),
      recentWorkouts: recentWorkouts.map((w) => ({ name: w.name, type: (w as any).type })),
      nutritionGoal: nutritionPlan
        ? { calories: (nutritionPlan as any).targetCalories, protein: (nutritionPlan as any).targetProtein }
        : undefined,
      userGoal: (user as any)?.goals?.primary || (user as any)?.profile?.fitnessGoal,
      notes: userNotes,
    };

    const prompt = buildPlannerUserPrompt(promptContext);

    const config = createGeminiConfig({
      systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: plannerGenerationSchema,
      temperature: 0.3,
    });

    const result = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config,
      primaryModel: flashModel,
    });

    const text = result.text || "{}";
    const data = JSON.parse(text);

    return NextResponse.json({
      success: true,
      date: targetDate,
      summary: data.summary || "Here is your optimized daily schedule.",
      events: sortEventsByPlannerTime(data.events || []),
      modelUsed: result.modelUsed,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
