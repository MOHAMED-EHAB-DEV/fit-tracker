import { HttpError, fail, ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/mongoose";
import Habit from "@/lib/db/models/Habit";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import User from "@/lib/db/models/User";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import {
  createGeminiConfig,
  formatAiErrorMessage,
  generateContentWithFallback,
} from "@/lib/gemini/client";
import { MODEL_CHAINS } from "@/lib/gemini/models";
import { PLANNER_SYSTEM_INSTRUCTION, buildPlannerUserPrompt } from "@/lib/gemini/planner-prompt";
import { computeTargets } from "@/lib/users/profile";
import { formatDateString } from "@/lib/time";
import { listEventsForDate } from "@/lib/planner/service";
import { normalizeAiPlanEvents } from "@/lib/planner/ai-plan";
import { MAX_AI_EVENTS, plannerGenerateSchema } from "@/lib/validation/planner";

// AI calls can be slow; give the function room before the platform cuts it off.
export const maxDuration = 60;

const plannerGenerationSchema = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One or two sentences on the day's strategy" },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          startTime: { type: "string", description: "HH:mm (24h)" },
          endTime: { type: "string", description: "HH:mm (24h), after startTime" },
          category: { type: "string", enum: ["workout", "nutrition", "habit", "recovery", "focus", "other"] },
          linkedHabitIds: { type: "array", items: { type: "string" } },
        },
        required: ["title", "startTime", "endTime", "category"],
      },
    },
  },
  required: ["summary", "events"],
};

/** Generates a plan for a day. Nothing is saved: the user reviews and applies it. */
export const POST = route({ body: plannerGenerateSchema, rateLimit: RATE_LIMITS.aiRoutePerMinute }, async ({ session, body }) => {
  await getDb();
  const userId = session.userId;

  const [user, habits, recentSessions, nutritionPlan, existingEvents] = await Promise.all([
    User.findById(userId).select("fitnessProfile computed").lean(),
    Habit.find({ userId, isActive: true }).select("_id name emoji").sort({ order: 1 }).lean(),
    WorkoutSession.find({ userId, status: "completed" })
      .sort({ endedAt: -1 })
      .limit(3)
      .select("name localDate")
      .lean(),
    NutritionPlan.findOne({ assignedTo: userId }).sort({ updatedAt: -1 }).select("targetCalories targetProteinG").lean(),
    listEventsForDate(userId, body.date),
  ]);

  const profile = user?.fitnessProfile;
  const targets = profile ? computeTargets(profile) : null;
  const calories = nutritionPlan?.targetCalories || profile?.targetCalories || targets?.calorieTarget || null;
  const protein = nutritionPlan?.targetProteinG || user?.computed?.proteinTargetG || targets?.proteinTargetG || null;

  const prompt = buildPlannerUserPrompt({
    date: body.date,
    dayName: formatDateString(body.date, { weekday: "long" }),
    habits: habits.map((habit) => ({ id: String(habit._id), name: habit.name, emoji: habit.emoji || "" })),
    existingEvents: existingEvents.map((event) => ({
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      recurring: event.recurrence !== "once",
    })),
    recentWorkouts: recentSessions.map((s) => ({ name: s.name, date: s.localDate })),
    nutritionGoal: calories || protein ? { calories, protein } : undefined,
    userGoal: profile?.goal || null,
    notes: body.notes,
  });

  let text: string | undefined;
  let modelUsed: string = MODEL_CHAINS.fast[0];
  try {
    const result = await generateContentWithFallback({
      userId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: createGeminiConfig({
        systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: plannerGenerationSchema,
        temperature: 0.3,
        maxOutputTokens: 2048,
      }),
      task: "fast",
    });
    text = result.text;
    modelUsed = result.modelUsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error("[planner/generate]", err);
    return fail(502, formatAiErrorMessage(err));
  }

  let parsed: { summary?: unknown; events?: unknown } = {};
  try {
    parsed = JSON.parse((text || "").replace(/```json\s*|```/g, "").trim() || "{}");
  } catch {
    return fail(502, "The AI returned a plan that could not be read. Please try again.");
  }

  const events = normalizeAiPlanEvents(
    parsed.events,
    habits.map((habit) => String(habit._id)),
    MAX_AI_EVENTS
  );
  if (events.length === 0) {
    return fail(502, "The AI did not return a usable plan. Try again, or add a few details in the notes.");
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 600) : "";
  return ok({ date: body.date, summary, events, existingEvents, modelUsed });
});
