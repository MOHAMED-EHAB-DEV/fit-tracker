import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { comparePassword } from "@/lib/auth/password";
import { issueSession } from "@/lib/auth/issue";
import { publicRoute, enforceRateLimit, HttpError } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

// A well-formed bcrypt hash of a random value. It is compared against when
// the email is unknown, so response time does not reveal whether an account
// exists.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5KhPz1cQ3bS0p6xNq1QJ0mYQ0w8yX2a";

export const POST = publicRoute(
  { body: loginSchema, rateLimit: RATE_LIMITS.loginPerIp },
  async ({ body }) => {
    await enforceRateLimit(RATE_LIMITS.loginPerEmail, body.email);
    await getDb();

    const user = await User.findOne({ email: body.email }).select("+passwordHash");
    const isMatch = await comparePassword(body.password, user?.passwordHash || DUMMY_HASH).catch(
      () => false
    );

    if (!user || !isMatch) {
      throw new HttpError(401, "Invalid email or password");
    }
    if (user.isBanned) {
      throw new HttpError(
        403,
        "This account has been suspended. Contact support if you think this is a mistake."
      );
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const hasBiometrics = Boolean(
      user.fitnessProfile?.weightKg && user.fitnessProfile?.heightCm && user.fitnessProfile?.sex
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        isProfileComplete: user.isProfileComplete === true || hasBiometrics,
      },
    });
    await issueSession(response, user);
    return response;
  }
);
