import { NextResponse } from "next/server";
import { getClientUser } from "@/lib/auth/session";
import { issueSession } from "@/lib/auth/issue";
import { route, ok, notFound } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { profilePatchSchema } from "@/lib/validation/profile";
import { updateUserProfile } from "@/lib/users/profile";
import User from "@/lib/db/models/User";

export const GET = route({}, async () => {
  const user = await getClientUser();
  if (!user) throw notFound("User not found");
  return ok({ user });
});

export const PATCH = route(
  { body: profilePatchSchema, rateLimit: RATE_LIMITS.writePerMinute },
  async ({ session, body }) => {
    const { invalidateAllSessions, ...patch } = body;
    await updateUserProfile(session.userId, patch);

    let reissueFor: { _id: unknown; email: string; name: string; tokenVersion?: number | null } | null = null;
    if (invalidateAllSessions) {
      // Revoke every existing session, then give THIS device a fresh one so
      // the person who pressed the button stays signed in.
      reissueFor = await User.findByIdAndUpdate(
        session.userId,
        { $inc: { tokenVersion: 1 } },
        { returnDocument: "after" }
      )
        .select("_id email name tokenVersion")
        .lean();
    }

    const response = NextResponse.json({ success: true, sessionsRevoked: Boolean(invalidateAllSessions) });
    if (reissueFor) await issueSession(response, reissueFor);
    return response;
  }
);
