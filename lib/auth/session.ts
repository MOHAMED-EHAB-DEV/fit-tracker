// The single place that decides who the current user is.
// Used by Server Components, Server Functions and Route Handlers.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { getDb } from "@/lib/db/mongoose";
import User, { type IUser } from "@/lib/db/models/User";
import { normalizeWeekStart, resolveTimeZone, type WeekdayKey } from "@/lib/time";
import { normalizeWeightUnit, type WeightUnit } from "@/lib/fitness/units";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: "user" | "admin";
  tokenVersion: number;
  /** The user's IANA time zone; every "today" is computed in it. */
  timezone: string;
  weightUnit: WeightUnit;
  weekStartDay: WeekdayKey;
  isProfileComplete: boolean;
}

type LeanUser = IUser;

/** Where pages send a visitor without a valid session (the proxy clears the stale cookie there). */
export const LOGIN_REDIRECT = "/login?expired=1";

function hasBiometrics(user: Pick<IUser, "fitnessProfile">): boolean {
  return Boolean(
    user.fitnessProfile?.weightKg && user.fitnessProfile?.heightCm && user.fitnessProfile?.sex
  );
}

/**
 * Loads the user behind the session cookie and validates the session against
 * the database: the account must exist, must not be banned, and the token
 * must not have been revoked ("log out all devices" bumps tokenVersion).
 */
const loadVerifiedUser = cache(async (): Promise<LeanUser | null> => {
  let token: string | undefined;
  try {
    token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return null;
  }
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  await getDb();
  const user = (await User.findById(payload.userId)
    .select("-passwordHash")
    .lean()) as LeanUser | null;

  if (!user) return null;
  if (user.isBanned) return null;
  if ((user.tokenVersion || 0) !== payload.tokenVersion) return null;
  return user;
});

/**
 * The verified session, or null. Safe to call many times per request
 * (memoized during a render pass).
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const user = await loadVerifiedUser();
  if (!user) return null;
  return {
    userId: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
    tokenVersion: user.tokenVersion || 0,
    timezone: resolveTimeZone(user.preferences?.timezone),
    weightUnit: normalizeWeightUnit(user.preferences?.weightUnit),
    weekStartDay: normalizeWeekStart(user.preferences?.weekStartDay),
    isProfileComplete: user.isProfileComplete === true || hasBiometrics(user),
  };
}

/**
 * The full user document (without the password hash or stored secrets),
 * or null when there is no valid session.
 */
export async function getFullUser(): Promise<IUser | null> {
  const user = await loadVerifiedUser();
  if (!user) return null;

  const complete = user.isProfileComplete === true || hasBiometrics(user);
  if (complete && user.isProfileComplete !== true) {
    await User.updateOne({ _id: user._id }, { $set: { isProfileComplete: true } }).catch(() => undefined);
  }

  return { ...user, isProfileComplete: complete } as unknown as IUser;
}

/** For pages: the signed-in user, or a redirect to /login. */
export async function requirePageUser(): Promise<IUser> {
  const user = await getFullUser();
  if (!user) redirect(LOGIN_REDIRECT);
  return user;
}

/** For pages: the session, or a redirect to /login. */
export async function requirePageSession(): Promise<SessionUser> {
  const session = await getServerSession();
  if (!session) redirect(LOGIN_REDIRECT);
  return session;
}

/**
 * The plain object handed to client components. It never contains secrets:
 * the personal Gemini key is reduced to a yes/no flag.
 */
export async function getClientUser(): Promise<Record<string, unknown> | null> {
  const user = await getFullUser();
  if (!user) return null;

  const withKey = await User.findById(user._id).select("+preferences.customGeminiApiKey").lean();
  const hasCustomGeminiKey = Boolean(withKey?.preferences?.customGeminiApiKey);

  const plain = JSON.parse(JSON.stringify(user)) as Record<string, unknown>;
  delete plain.tokenVersion;
  delete plain.passwordHash;
  delete plain.passwordResetTokenHash;
  delete plain.passwordResetExpiresAt;

  const preferences = { ...((plain.preferences as Record<string, unknown>) || {}) };
  delete preferences.customGeminiApiKey;
  preferences.hasCustomGeminiKey = hasCustomGeminiKey;
  preferences.timezone = resolveTimeZone(user.preferences?.timezone);
  preferences.weightUnit = normalizeWeightUnit(user.preferences?.weightUnit);
  preferences.weekStartDay = normalizeWeekStart(user.preferences?.weekStartDay);
  plain.preferences = preferences;

  return plain;
}
