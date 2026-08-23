import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import cloudinary from "@/lib/cloudinary";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    await getDb();

    const meal = await Meal.findOne({ _id: id, userId: session.userId }).lean();
    if (!meal) {
      return NextResponse.json({ success: false, error: "Meal not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, meal });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { description, mealType, macros } = body;

    await getDb();

    const existingMeal = await Meal.findOne({ _id: id, userId: session.userId });
    if (!existingMeal) {
      return NextResponse.json({ success: false, error: "Meal not found" }, { status: 404 });
    }

    const oldCalories = existingMeal.macros?.calories || 0;
    const oldProtein = existingMeal.macros?.protein || 0;
    const oldCarbs = existingMeal.macros?.carbs || 0;
    const oldFat = existingMeal.macros?.fat || 0;
    const oldFiber = existingMeal.macros?.fiber || 0;

    const newCalories = macros?.calories !== undefined ? Number(macros.calories) || 0 : oldCalories;
    const newProtein = macros?.protein !== undefined ? Number(macros.protein) || 0 : oldProtein;
    const newCarbs = macros?.carbs !== undefined ? Number(macros.carbs) || 0 : oldCarbs;
    const newFat = macros?.fat !== undefined ? Number(macros.fat) || 0 : oldFat;
    const newFiber = macros?.fiber !== undefined ? Number(macros.fiber) || 0 : oldFiber;

    const deltaCalories = newCalories - oldCalories;
    const deltaProtein = newProtein - oldProtein;
    const deltaCarbs = newCarbs - oldCarbs;
    const deltaFat = newFat - oldFat;
    const deltaFiber = newFiber - oldFiber;

    if (description !== undefined && typeof description === "string") {
      existingMeal.description = description.trim();
    }
    if (mealType !== undefined && typeof mealType === "string") {
      existingMeal.mealType = mealType as any;
    }

    existingMeal.macros = {
      calories: newCalories,
      protein: newProtein,
      carbs: newCarbs,
      fat: newFat,
      fiber: newFiber,
    };
    existingMeal.isManualOverride = true;

    await existingMeal.save();

    // Adjust DailyLog if macros changed
    if (
      deltaCalories !== 0 ||
      deltaProtein !== 0 ||
      deltaCarbs !== 0 ||
      deltaFat !== 0 ||
      deltaFiber !== 0
    ) {
      await DailyLog.findOneAndUpdate(
        { userId: session.userId, dateString: existingMeal.dateString },
        {
          $inc: {
            caloriesIn: deltaCalories,
            "macros.protein": deltaProtein,
            "macros.carbs": deltaCarbs,
            "macros.fat": deltaFat,
            "macros.fiber": deltaFiber,
          },
        }
      );
    }

    return NextResponse.json({ success: true, meal: existingMeal });
  } catch (err: any) {
    console.error("Meal PATCH error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    await getDb();

    const existingMeal = await Meal.findOne({ _id: id, userId: session.userId });
    if (!existingMeal) {
      return NextResponse.json({ success: false, error: "Meal not found" }, { status: 404 });
    }

    const caloriesToDeduct = existingMeal.macros?.calories || 0;
    const proteinToDeduct = existingMeal.macros?.protein || 0;
    const carbsToDeduct = existingMeal.macros?.carbs || 0;
    const fatToDeduct = existingMeal.macros?.fat || 0;
    const fiberToDeduct = existingMeal.macros?.fiber || 0;

    // Deduct macros from DailyLog
    await DailyLog.findOneAndUpdate(
      { userId: session.userId, dateString: existingMeal.dateString },
      {
        $inc: {
          caloriesIn: -caloriesToDeduct,
          "macros.protein": -proteinToDeduct,
          "macros.carbs": -carbsToDeduct,
          "macros.fat": -fatToDeduct,
          "macros.fiber": -fiberToDeduct,
        },
      }
    );

    // Optional: remove image from Cloudinary if existed
    if (existingMeal.cloudinary?.publicId) {
      try {
        await cloudinary.uploader.destroy(existingMeal.cloudinary.publicId);
      } catch (cloudErr) {
        console.warn("Could not delete Cloudinary image for meal:", cloudErr);
      }
    }

    await Meal.deleteOne({ _id: id, userId: session.userId });

    return NextResponse.json({ success: true, message: "Meal deleted successfully" });
  } catch (err: any) {
    console.error("Meal DELETE error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
