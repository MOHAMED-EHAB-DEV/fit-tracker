// For use in React Server Components and API route handlers.
// Reads the 'token' cookie or 'Authorization: Bearer <token>' header, verifies it, and optionally fetches the full User.
import { cookies } from "next/headers";
import { verifyToken, type JWTPayload } from "@/lib/auth/jwt";
import { getDb } from "@/lib/db/mongoose";
import User, { type IUser } from "@/lib/db/models/User";

/**
 * Returns the decoded JWT payload from the 'Authorization' header or 'token' cookie.
 * Does NOT hit the database.
 */
export async function getServerSession(req?: Request | null): Promise<JWTPayload | null> {
  try {
    // 1. Check Bearer Authorization header if request object provided
    if (req) {
      const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        const bearerToken = authHeader.substring(7).trim();
        if (bearerToken) {
          const verified = await verifyToken(bearerToken);
          if (verified) return verified;
        }
      }
    }

    // 2. Fall back to Next.js cookie store
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Returns the full User document from MongoDB.
 * Calls getServerSession() first, then queries MongoDB once.
 * Call this in (app)/layout.tsx — result is passed to UserContext.
 */
export async function getFullUser(req?: Request | null): Promise<IUser | null> {
  const session = await getServerSession(req);
  if (!session) return null;

  await getDb();
  const user = await User.findById(session.userId)
    .select("-passwordHash")
    .lean();

  if (!user) return null;

  // Token version check — increment User.tokenVersion to invalidate all sessions
  if ((user as any).tokenVersion !== session.tokenVersion) return null;

  // Check if profile is complete (explicit flag OR existing biometrics)
  const hasBiometrics = Boolean(
    (user as any).fitnessProfile?.weightKg &&
    (user as any).fitnessProfile?.heightCm &&
    (user as any).fitnessProfile?.sex
  );

  const isComplete = (user as any).isProfileComplete === true || hasBiometrics;

  // If user has biometrics but isProfileComplete wasn't persisted yet, update asynchronously
  if (hasBiometrics && (user as any).isProfileComplete !== true) {
    User.updateOne({ _id: (user as any)._id }, { $set: { isProfileComplete: true } }).exec();
  }

  (user as any).isProfileComplete = isComplete;

  return user as unknown as IUser;
}
