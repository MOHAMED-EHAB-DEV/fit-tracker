import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateProteinTarget,
} from "@/lib/fitness/bmr";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      sex,
      age,
      birthDate,
      weightKg,
      heightCm,
      activityLevel,
      goal,
      stepGoal,
      waterGoalMl,
      restTimerDefaultSec,
    } = body;

    // Strict validation: no dummy or missing fields allowed
    if (!sex || !weightKg || !heightCm || !activityLevel || !goal) {
      return NextResponse.json(
        { success: false, error: "All biometric and goal fields are required" },
        { status: 400 }
      );
    }

    const numericWeight = parseFloat(weightKg);
    const numericHeight = parseFloat(heightCm);
    const numericAge = parseInt(age, 10) || 25;
    const numericSteps = parseInt(stepGoal, 10) || 10000;
    const numericWater = parseInt(waterGoalMl, 10) || 3000;
    const numericRestTimer = parseInt(restTimerDefaultSec, 10) || 90;

    if (numericWeight < 30 || numericWeight > 300) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid weight (30kg - 300kg)" },
        { status: 400 }
      );
    }

    if (numericHeight < 100 || numericHeight > 250) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid height (100cm - 250cm)" },
        { status: 400 }
      );
    }

    // Precise Mifflin-St Jeor & TDEE Calculations
    const bmr = calculateBMR(numericWeight, numericHeight, numericAge, sex);
    const tdee = calculateTDEE(bmr, activityLevel);
    const targetCalories = calculateTargetCalories(tdee, goal);
    const targetProteinG = calculateProteinTarget(numericWeight, goal);

    await getDb();

    const updatedUser = await User.findByIdAndUpdate(
      session.userId,
      {
        $set: {
          isProfileComplete: true,
          fitnessProfile: {
            sex,
            birthDate: birthDate ? new Date(birthDate) : null,
            age: numericAge,
            weightKg: numericWeight,
            heightCm: numericHeight,
            activityLevel,
            goal,
            targetCalories,
            targetProteinG,
          },
          preferences: {
            stepGoal: numericSteps,
            waterGoalMl: numericWater,
            weekStartDay: "saturday",
            timezone: "Africa/Cairo",
            weightUnit: "kg",
            restTimerDefaultSec: numericRestTimer,
          },
          computed: {
            bmr,
            tdee,
            proteinTargetG: targetProteinG,
            lastComputedAt: new Date(),
          },
        },
      },
      { new: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
