import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { hashPassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/issue";
import { publicRoute, conflict } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { signupSchema } from "@/lib/validation/auth";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export const POST = publicRoute(
  { body: signupSchema, rateLimit: RATE_LIMITS.signupPerIp },
  async ({ body }) => {
    await getDb();

    const existing = await User.exists({ email: body.email });
    if (existing) throw conflict("An account with this email already exists");

    const passwordHash = await hashPassword(body.password);

    let user;
    try {
      user = await User.create({
        name: body.name,
        email: body.email,
        passwordHash,
        tokenVersion: 0,
        isProfileComplete: false,
        preferences: {
          stepGoal: null,
          waterGoalMl: null,
          weekStartDay: "saturday",
          timezone: body.timezone || DEFAULT_TIMEZONE,
          weightUnit: body.weightUnit || "kg",
          restTimerDefaultSec: null,
        },
      });
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        throw conflict("An account with this email already exists");
      }
      throw err;
    }

    const response = NextResponse.json(
      {
        success: true,
        user: { id: String(user._id), name: user.name, email: user.email, isProfileComplete: false },
      },
      { status: 201 }
    );
    await issueSession(response, user);
    return response;
  }
);
