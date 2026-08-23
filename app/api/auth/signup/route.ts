import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { setTokenCookie } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await getDb();

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      tokenVersion: 0,
      isProfileComplete: false,
      fitnessProfile: {
        sex: null,
        birthDate: null,
        age: null,
        weightKg: null,
        heightCm: null,
        activityLevel: null,
        goal: null,
        targetCalories: null,
        targetProteinG: null,
      },
      preferences: {
        stepGoal: null,
        waterGoalMl: null,
        weekStartDay: "saturday",
        timezone: "Africa/Cairo",
        weightUnit: "kg",
        restTimerDefaultSec: null,
      },
      computed: {
        bmr: null,
        tdee: null,
        proteinTargetG: null,
        lastComputedAt: null,
      },
    });

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      tokenVersion: user.tokenVersion,
    });

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          isProfileComplete: false,
        },
      },
      { status: 201 }
    );

    setTokenCookie(response, token);
    return response;
  } catch (err: any) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
