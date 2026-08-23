import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || getTodayDateString();

    await getDb();
    const meals = await Meal.find({
      userId: session.userId,
      dateString: dateStr,
    }).sort({ loggedAt: -1 });

    return NextResponse.json({ success: true, meals });
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

    const body = await request.json();
    const { mealType, description, macros, dateString } = body;

    if (!mealType || !macros) {
      return NextResponse.json({ success: false, error: "Missing required meal fields" }, { status: 400 });
    }

    await getDb();
    const targetDateStr = dateString || getTodayDateString();

    const meal = await Meal.create({
      userId: session.userId,
      loggedAt: new Date(),
      dateString: targetDateStr,
      mealType,
      description: description || "Manual Meal",
      imageSource: "text_only",
      macros: {
        calories: Number(macros.calories) || 0,
        protein: Number(macros.protein) || 0,
        carbs: Number(macros.carbs) || 0,
        fat: Number(macros.fat) || 0,
        fiber: Number(macros.fiber) || 0,
      },
      isManualOverride: true,
    });

    await DailyLog.findOneAndUpdate(
      { userId: session.userId, dateString: targetDateStr },
      {
        $inc: {
          caloriesIn: Number(macros.calories) || 0,
          "macros.protein": Number(macros.protein) || 0,
          "macros.carbs": Number(macros.carbs) || 0,
          "macros.fat": Number(macros.fat) || 0,
          "macros.fiber": Number(macros.fiber) || 0,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, meal }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
