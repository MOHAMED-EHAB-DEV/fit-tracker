import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { publicRoute, badRequest, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { sha256Hex } from "@/lib/security/secrets";

export const POST = publicRoute(
  { body: resetPasswordSchema, rateLimit: RATE_LIMITS.passwordResetPerIp },
  async ({ body }) => {
    await getDb();

    const passwordHash = await hashPassword(body.password);

    // One atomic step: the token is consumed and every existing session is
    // revoked (tokenVersion is bumped) together with the password change.
    const updated = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: sha256Hex(body.token),
        passwordResetExpiresAt: { $gt: new Date() },
        isBanned: { $ne: true },
      },
      {
        $set: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: "after" }
    ).select("_id");

    if (!updated) throw badRequest("This reset link is invalid or has expired. Request a new one.");

    return ok({ message: "Password updated. You can sign in now." });
  }
);
