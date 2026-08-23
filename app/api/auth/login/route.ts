import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { comparePassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { setTokenCookie } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    await getDb();

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Update lastLoginAt asynchronously
    User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).exec();

    const token = await signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      tokenVersion: user.tokenVersion || 0,
    });

    const hasBiometrics = Boolean(
      user.fitnessProfile?.weightKg &&
      user.fitnessProfile?.heightCm &&
      user.fitnessProfile?.sex
    );
    const isProfileComplete = user.isProfileComplete === true || hasBiometrics;

    const response = NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        isProfileComplete,
      },
    });

    setTokenCookie(response, token);
    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
