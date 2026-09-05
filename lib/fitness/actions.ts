"use server";

import { revalidatePath } from "next/cache";
import { getFullUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import DailyLog from "@/lib/db/models/DailyLog";
import { getTodayDateString } from "@/lib/fitness/timezone";

export async function logWaterAction(amountMl: number): Promise<{ success: boolean; waterMl?: number; error?: string }> {
  try {
    const user = await getFullUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!amountMl || amountMl <= 0) {
      return { success: false, error: "Invalid water amount" };
    }

    await getDb();
    const todayStr = getTodayDateString();

    const updatedLog = await DailyLog.findOneAndUpdate(
      { userId: user._id, dateString: todayStr },
      { $inc: { waterMl: amountMl } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    revalidatePath("/");
    return { success: true, waterMl: updatedLog.waterMl };
  } catch (err: any) {
    console.error("logWaterAction Error:", err);
    return { success: false, error: err.message || "Failed to log water" };
  }
}

export async function deleteWorkoutAction(workoutId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getFullUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!workoutId) {
      return { success: false, error: "Workout ID is required" };
    }

    await getDb();
    const Workout = (await import("@/lib/db/models/Workout")).default;

    const deleted = await Workout.findOneAndDelete({ _id: workoutId, userId: user._id });
    if (deleted && deleted.status === "completed" && deleted.estimatedCalories > 0) {
      const dateStr = getTodayDateString(deleted.completedAt || deleted.date || deleted.startedAt || deleted.createdAt);
      await DailyLog.findOneAndUpdate(
        { userId: user._id, dateString: dateStr },
        {
          $inc: {
            "caloriesOut.workouts": -deleted.estimatedCalories,
            "caloriesOut.total": -deleted.estimatedCalories,
          },
        }
      );
    }

    revalidatePath("/");
    revalidatePath("/workouts");
    revalidatePath("/workouts/sessions");
    return { success: true };
  } catch (err: any) {
    console.error("deleteWorkoutAction Error:", err);
    return { success: false, error: err.message || "Failed to delete workout" };
  }
}

export async function deleteMealAction(mealId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getFullUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!mealId) {
      return { success: false, error: "Meal ID is required" };
    }

    await getDb();
    const Meal = (await import("@/lib/db/models/Meal")).default;

    const deletedMeal = await Meal.findOneAndDelete({ _id: mealId, userId: user._id });

    if (deletedMeal) {
      const dateString = deletedMeal.dateString;
      const cal = deletedMeal.macros?.calories || 0;
      const p = deletedMeal.macros?.protein || 0;
      const c = deletedMeal.macros?.carbs || 0;
      const f = deletedMeal.macros?.fat || 0;
      const fib = deletedMeal.macros?.fiber || 0;

      if (dateString) {
        await DailyLog.findOneAndUpdate(
          { userId: user._id, dateString },
          {
            $inc: {
              caloriesIn: -cal,
              "macros.protein": -p,
              "macros.carbs": -c,
              "macros.fat": -f,
              "macros.fiber": -fib,
            },
          }
        );
      }
    }

    revalidatePath("/");
    revalidatePath("/nutrition");
    return { success: true };
  } catch (err: any) {
    console.error("deleteMealAction Error:", err);
    return { success: false, error: err.message || "Failed to delete meal" };
  }
}

export async function updateWeeklyRoutineAction(routineDays: any[]): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getFullUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    await getDb();
    const User = (await import("@/lib/db/models/User")).default;

    await User.findByIdAndUpdate(user._id, {
      weeklyRoutine: routineDays,
    });

    revalidatePath("/");
    revalidatePath("/workouts");
    return { success: true };
  } catch (err: any) {
    console.error("updateWeeklyRoutineAction Error:", err);
    return { success: false, error: err.message || "Failed to update routine" };
  }
}

export async function updateProfileSettingsAction(payload: {
  name: string;
  fitnessProfile: any;
  preferences: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getFullUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    await getDb();
    const User = (await import("@/lib/db/models/User")).default;
    const {
      calculateBMR,
      calculateTDEE,
      calculateTargetCalories,
      calculateProteinTarget,
      calculateFatTarget,
      calculateCarbsTarget,
      calculateFiberTarget,
    } = await import("@/lib/fitness/bmr");

    const sex = payload.fitnessProfile.sex || user.fitnessProfile?.sex || "male";
    const weightKg = payload.fitnessProfile.weightKg ?? user.fitnessProfile?.weightKg;
    const heightCm = payload.fitnessProfile.heightCm ?? user.fitnessProfile?.heightCm;
    const age = payload.fitnessProfile.age || user.fitnessProfile?.age || 25;
    const activityLevel = payload.fitnessProfile.activityLevel || user.fitnessProfile?.activityLevel || "moderate";
    const goal = payload.fitnessProfile.goal || user.fitnessProfile?.goal || "maintain";

    let bmr = null;
    let tdee = null;
    let computedCalories = null;
    let computedProtein = null;

    if (weightKg && heightCm && age) {
      bmr = calculateBMR(weightKg, heightCm, age, sex);
      tdee = calculateTDEE(bmr, activityLevel);
      computedCalories = calculateTargetCalories(tdee, goal);
      computedProtein = calculateProteinTarget(weightKg, goal);
    }

    const targetCalories = payload.fitnessProfile.targetCalories ?? user.fitnessProfile?.targetCalories ?? computedCalories;
    const targetProteinG = payload.fitnessProfile.targetProteinG ?? user.fitnessProfile?.targetProteinG ?? computedProtein;
    const targetFatG = payload.fitnessProfile.targetFatG ?? user.fitnessProfile?.targetFatG ?? (targetCalories ? calculateFatTarget(targetCalories) : null);
    const targetCarbsG = payload.fitnessProfile.targetCarbsG ?? user.fitnessProfile?.targetCarbsG ?? (targetCalories && targetProteinG && targetFatG ? calculateCarbsTarget(targetCalories, targetProteinG, targetFatG) : null);
    const targetFiberG = payload.fitnessProfile.targetFiberG ?? user.fitnessProfile?.targetFiberG ?? (targetCalories ? calculateFiberTarget(targetCalories) : null);

    await User.findByIdAndUpdate(user._id, {
      name: payload.name,
      fitnessProfile: {
        ...payload.fitnessProfile,
        targetCalories,
        targetProteinG,
        targetCarbsG,
        targetFatG,
        targetFiberG,
      },
      preferences: {
        ...(user.preferences || {}),
        ...payload.preferences,
      },
      computed: {
        bmr,
        tdee,
        proteinTargetG: targetProteinG,
        carbsTargetG: targetCarbsG,
        fatTargetG: targetFatG,
        fiberTargetG: targetFiberG,
        lastComputedAt: new Date(),
      },
    });

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/nutrition");
    return { success: true };
  } catch (err: any) {
    console.error("updateProfileSettingsAction Error:", err);
    return { success: false, error: err.message || "Failed to update profile settings" };
  }
}
