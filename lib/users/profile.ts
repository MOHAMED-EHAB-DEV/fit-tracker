import "server-only";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { ageFromProfile, computeTargets, type ComputedTargets, type ProfileFields } from "@/lib/fitness/targets";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/security/secrets";
import { notFound } from "@/lib/api/errors";
import type { ProfilePatch } from "@/lib/validation/profile";

/**
 * The one place that changes a user's profile. It only touches the fields it
 * is given (dotted-path updates), so nothing else in the profile is lost, and
 * it always recalculates BMR, TDEE and the automatic targets afterwards.
 */

// The maths lives in lib/fitness/targets (shared with the browser).
export { ageFromProfile, computeTargets };
export type { ComputedTargets, ProfileFields };

const TARGET_KEYS = [
  "targetCalories",
  "targetProteinG",
  "targetFatG",
  "targetCarbsG",
  "targetFiberG",
] as const;

/**
 * Returns `patch` with every custom target that merely repeats the automatic
 * value replaced by null ("calculate it for me"). `merged` is the profile as
 * it will be after the patch.
 */
export function withoutRedundantTargets<T extends ProfileFields>(merged: ProfileFields, patch: T): T {
  const result: ProfileFields = { ...patch };
  const working: ProfileFields = { ...merged };

  // Order matters: carbs depend on calories, protein and fat.
  for (const key of TARGET_KEYS) {
    if (!(key in patch)) continue;
    const custom = patch[key];
    if (custom == null) {
      working[key] = null;
      continue;
    }
    const auto = computeTargets({ ...working, [key]: null });
    const autoValue =
      key === "targetCalories"
        ? auto.calorieTarget
        : key === "targetProteinG"
          ? auto.proteinTargetG
          : key === "targetFatG"
            ? auto.fatTargetG
            : key === "targetCarbsG"
              ? auto.carbsTargetG
              : auto.fiberTargetG;
    if (autoValue != null && Math.round(custom) === Math.round(autoValue)) {
      result[key] = null;
      working[key] = null;
    } else {
      working[key] = custom;
    }
  }
  return result as T;
}

interface UpdateOptions {
  /** Marks onboarding as finished. */
  completeProfile?: boolean;
}

export async function updateUserProfile(
  userId: string,
  patch: ProfilePatch,
  options: UpdateOptions = {}
): Promise<void> {
  await getDb();
  const user = await User.findById(userId).select("fitnessProfile").lean();
  if (!user) throw notFound("User not found");

  const set: Record<string, unknown> = {};

  if (patch.name !== undefined) set.name = patch.name;

  const profilePatch = patch.fitnessProfile || {};
  for (const [key, value] of Object.entries(profilePatch)) {
    if (value === undefined) continue;
    set[`fitnessProfile.${key}`] = key === "birthDate" && value ? new Date(`${value}T00:00:00.000Z`) : value;
  }

  for (const [key, value] of Object.entries(patch.preferences || {})) {
    if (value !== undefined) set[`preferences.${key}`] = value;
  }

  if (patch.customGeminiApiKey !== undefined) {
    set["preferences.customGeminiApiKey"] = patch.customGeminiApiKey
      ? encryptSecret(patch.customGeminiApiKey)
      : null;
  }

  const merged: ProfileFields = {
    ...((user.fitnessProfile as ProfileFields) || {}),
    ...(profilePatch as ProfileFields),
  };
  // Keep the stored age in step with the birth date.
  if (merged.birthDate) set["fitnessProfile.age"] = ageFromProfile(merged);

  const targets = computeTargets(merged);
  set["computed.bmr"] = targets.bmr;
  set["computed.tdee"] = targets.tdee;
  set["computed.proteinTargetG"] = targets.proteinTargetG;
  set["computed.carbsTargetG"] = targets.carbsTargetG;
  set["computed.fatTargetG"] = targets.fatTargetG;
  set["computed.fiberTargetG"] = targets.fiberTargetG;
  set["computed.lastComputedAt"] = new Date();

  if (options.completeProfile) set.isProfileComplete = true;

  await User.updateOne({ _id: userId }, { $set: set }, { runValidators: true });
}

/**
 * The user's personal Gemini key in plain text, or null. Keys saved before
 * encryption existed are encrypted the first time they are read.
 */
export async function getUserGeminiKey(userId: string): Promise<string | null> {
  await getDb();
  const user = await User.findById(userId).select("+preferences.customGeminiApiKey").lean();
  const stored = user?.preferences?.customGeminiApiKey;
  if (!stored) return null;

  const plain = decryptSecret(stored);
  if (plain && !isEncryptedSecret(stored)) {
    await User.updateOne(
      { _id: userId },
      { $set: { "preferences.customGeminiApiKey": encryptSecret(plain) } }
    ).catch(() => undefined);
  }
  return plain?.trim() || null;
}
