import { ok, route, badRequest } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import User from "@/lib/db/models/User";
import { recomputeDay, stepsToCalories } from "@/lib/fitness/daily-log";
import { getTodayDateString } from "@/lib/fitness/timezone";
import { stepsDateError, stepsQuery, stepsSyncBody } from "@/lib/validation/steps";

const DEFAULT_STEP_GOAL = 10_000;

interface StepsLogView {
  steps?: number | null;
  stepsSource?: string | null;
  stepsSyncedAt?: Date | null;
  caloriesOut?: { steps?: number | null; total?: number | null } | null;
}

/** Today's (or `?date=`) stored steps for the signed-in user. */
export const GET = route({ query: stepsQuery }, async ({ session, query }) => {
  const date = query.date ?? getTodayDateString(new Date(), session.timezone);
  await getDb();

  const [user, log] = await Promise.all([
    User.findById(session.userId).select("preferences.stepGoal").lean(),
    DailyLog.findOne({ userId: session.userId, dateString: date })
      .select("steps stepsSource stepsSyncedAt caloriesOut")
      .lean<StepsLogView | null>(),
  ]);

  const steps = log?.steps || 0;
  return ok({
    date,
    steps,
    stepGoal: user?.preferences?.stepGoal || DEFAULT_STEP_GOAL,
    stepCalories: log?.caloriesOut?.steps ?? stepsToCalories(steps),
    stepsSyncedAt: log?.stepsSyncedAt || null,
    stepsSource: log?.stepsSource || null,
  });
});

/**
 * Stores a day's step total, then rebuilds that day's calorie totals from the
 * stored value (so calories always match the steps actually kept).
 * Sensor posts only raise the total; manual posts set it exactly.
 */
export const POST = route(
  { body: stepsSyncBody, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const today = getTodayDateString(new Date(), session.timezone);
    const date = body.dateString ?? today;
    const dateError = stepsDateError(date, today);
    if (dateError) throw badRequest(dateError);

    await getDb();
    const filter = { userId: session.userId, dateString: date };
    const now = new Date();
    const insertDefaults = {
      date: new Date(`${date}T00:00:00.000Z`),
      waterMl: 0,
      waterEntries: [],
      completedHabitIds: [],
    };

    const upsert = async (update: Record<string, unknown>) => {
      try {
        await DailyLog.updateOne(filter, update, { upsert: true });
      } catch (err) {
        // Two first writes for the same day can race on the unique index: retry once.
        if ((err as { code?: number })?.code !== 11000) throw err;
        await DailyLog.updateOne(filter, update, { upsert: true });
      }
    };

    if (body.source === "manual") {
      await upsert({
        $set: { steps: body.steps, stepsSource: "manual", stepsSyncedAt: now },
        $setOnInsert: insertDefaults,
      });
    } else {
      // Raise the stored value only when the reading is higher (atomic).
      const raised = await DailyLog.updateOne(
        { ...filter, $or: [{ steps: { $lt: body.steps } }, { steps: null }] },
        { $set: { steps: body.steps, stepsSource: "step_counter", stepsSyncedAt: now } }
      );
      if (raised.matchedCount === 0) {
        // No day yet, or it already has more. $max also covers two first posts
        // for the same day racing: the higher reading always wins.
        await upsert({
          $max: { steps: body.steps },
          $set: { stepsSyncedAt: now },
          $setOnInsert: { ...insertDefaults, stepsSource: "step_counter" },
        });
      }
    }

    await recomputeDay(session.userId, date);

    const log = await DailyLog.findOne(filter)
      .select("steps stepsSource caloriesOut")
      .lean<StepsLogView | null>();
    const steps = log?.steps || 0;

    return ok({
      date,
      steps,
      // Kept for older app builds that read this name.
      updatedSteps: steps,
      source: log?.stepsSource || body.source,
      stepCalories: log?.caloriesOut?.steps ?? stepsToCalories(steps),
      totalCaloriesOut: log?.caloriesOut?.total ?? 0,
    });
  }
);
