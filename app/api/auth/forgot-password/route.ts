import { after } from "next/server";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { publicRoute, enforceRateLimit, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { randomToken, sha256Hex } from "@/lib/security/secrets";
import { emailLinkBaseUrl, sendEmail } from "@/lib/email";

const RESET_TOKEN_MINUTES = 30;

export const POST = publicRoute(
  { body: forgotPasswordSchema, rateLimit: RATE_LIMITS.passwordResetPerIp },
  async ({ request, body }) => {
    await enforceRateLimit(RATE_LIMITS.passwordResetPerEmail, body.email);
    await getDb();

    const user = await User.findOne({ email: body.email }).select("_id email name isBanned").lean();
    if (user && !user.isBanned) {
      const baseUrl = emailLinkBaseUrl(request.nextUrl.origin);
      // The token and the email are handled after the response, so the answer
      // takes the same time whether or not the account exists.
      after(async () => {
        if (!baseUrl) {
          console.error("[auth] APP_URL is not set: password reset emails cannot contain a safe link.");
          return;
        }
        const token = randomToken(32);
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordResetTokenHash: sha256Hex(token),
              passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
            },
          }
        );
        const link = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        await sendEmail({
          to: user.email,
          subject: "Reset your FitTracker password",
          text: `Hi ${user.name},\n\nUse this link to choose a new password. It works once and expires in ${RESET_TOKEN_MINUTES} minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
        });
      });
    }

    // Same answer whether or not the account exists.
    return ok({ message: "If an account exists for that email, a reset link is on its way." });
  }
);
