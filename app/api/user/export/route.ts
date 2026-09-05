import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import DailyLog from "@/lib/db/models/DailyLog";
import Meal from "@/lib/db/models/Meal";
import Workout from "@/lib/db/models/Workout";
import BodyComp from "@/lib/db/models/BodyComp";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();

    const [user, dailyLogs, meals, workouts, bodyComp] = await Promise.all([
      User.findById(session.userId)
        .select("-passwordHash -__v")
        .lean(),
      DailyLog.find({ userId: session.userId })
        .select("-__v")
        .sort({ dateString: -1 })
        .lean(),
      Meal.find({ userId: session.userId })
        .select("-__v")
        .sort({ dateString: -1, loggedAt: -1 })
        .lean(),
      Workout.find({ userId: session.userId })
        .select("-__v")
        .sort({ startedAt: -1 })
        .lean(),
      BodyComp.find({ userId: session.userId })
        .select("-__v")
        .sort({ checkInDate: -1 })
        .lean(),
    ]);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const todayStr = getTodayDateString();
    const exportPayload = {
      app: "FitTracker",
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        fitnessProfile: user.fitnessProfile,
        preferences: {
          ...user.preferences,
          // Mask API key for privacy/security
          customGeminiApiKey: user.preferences?.customGeminiApiKey ? "REDACTED" : null,
        },
        computed: user.computed,
        weeklyRoutine: user.weeklyRoutine,
        createdAt: user.createdAt,
      },
      summary: {
        totalDailyLogs: dailyLogs.length,
        totalMeals: meals.length,
        totalWorkouts: workouts.length,
        totalBodyCompLogs: bodyComp.length,
      },
      dailyLogs,
      meals,
      workouts,
      bodyComposition: bodyComp,
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="fittracker-export-${todayStr}.json"`,
      },
    });
  } catch (err: any) {
    console.error("Export user data error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to export data" }, { status: 500 });
  }
}
