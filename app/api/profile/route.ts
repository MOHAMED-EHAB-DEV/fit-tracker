import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateProteinTarget,
  calculateFatTarget,
  calculateCarbsTarget,
  calculateFiberTarget,
} from "@/lib/fitness/bmr";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();
    const user = await User.findById(session.userId).select("-passwordHash").lean();
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, fitnessProfile, preferences, invalidateAllSessions } = body;

    await getDb();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (name) user.name = name.trim();

    if (fitnessProfile) {
      user.fitnessProfile = {
        ...user.fitnessProfile,
        ...fitnessProfile,
      };

      // Recompute BMR, TDEE, and targets
      const weight = user.fitnessProfile.weightKg;
      const height = user.fitnessProfile.heightCm;
      const birthDate = user.fitnessProfile.birthDate;
      const sex = user.fitnessProfile.sex || "male";
      const activity = user.fitnessProfile.activityLevel || "moderate";
      const goal = user.fitnessProfile.goal || "maintain";

      let age = 25;
      if (birthDate) {
        const diffMs = Date.now() - new Date(birthDate).getTime();
        age = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      }

      if (weight && height) {
        const bmr = calculateBMR(weight, height, age, sex);
        const tdee = calculateTDEE(bmr, activity);
        const targetCal = user.fitnessProfile.targetCalories || calculateTargetCalories(tdee, goal);
        const targetProtein = user.fitnessProfile.targetProteinG || calculateProteinTarget(weight, goal);
        const targetFat = user.fitnessProfile.targetFatG || calculateFatTarget(targetCal);
        const targetCarbs = user.fitnessProfile.targetCarbsG || calculateCarbsTarget(targetCal, targetProtein, targetFat);
        const targetFiber = user.fitnessProfile.targetFiberG || calculateFiberTarget(targetCal);

        user.computed = {
          bmr,
          tdee,
          proteinTargetG: targetProtein,
          carbsTargetG: targetCarbs,
          fatTargetG: targetFat,
          fiberTargetG: targetFiber,
          lastComputedAt: new Date(),
        };

        if (!user.fitnessProfile.targetCalories) {
          user.fitnessProfile.targetCalories = targetCal;
        }
        if (!user.fitnessProfile.targetProteinG) {
          user.fitnessProfile.targetProteinG = targetProtein;
        }
        if (!user.fitnessProfile.targetCarbsG) {
          user.fitnessProfile.targetCarbsG = targetCarbs;
        }
        if (!user.fitnessProfile.targetFatG) {
          user.fitnessProfile.targetFatG = targetFat;
        }
        if (!user.fitnessProfile.targetFiberG) {
          user.fitnessProfile.targetFiberG = targetFiber;
        }
      }
    }

    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };
    }

    if (invalidateAllSessions) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    const sanitized = user.toObject();
    delete (sanitized as any).passwordHash;

    return NextResponse.json({ success: true, user: sanitized });
  } catch (err: any) {
    console.error("Profile update error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
