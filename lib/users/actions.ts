"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import { updateUserProfile, withoutRedundantTargets } from "@/lib/users/profile";
import { fitnessProfilePatch, preferencesPatch } from "@/lib/validation/profile";
import { describeZodError, publicErrorMessage } from "@/lib/api/route";

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  fitnessProfile: fitnessProfilePatch,
  preferences: preferencesPatch.optional(),
  /** A new key to save. Leave out (or empty) to keep the current one. */
  customGeminiApiKey: z.string().trim().max(200).optional(),
  /** True to delete the saved key. */
  removeCustomGeminiApiKey: z.boolean().optional(),
});

export type SettingsPayload = z.input<typeof settingsSchema>;

export async function updateProfileSettingsAction(
  payload: SettingsPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession();
    if (!session) return { success: false, error: "Your session has expired. Please sign in again." };

    const parsed = settingsSchema.safeParse(payload);
    if (!parsed.success) return { success: false, error: describeZodError(parsed.error) };
    const data = parsed.data;

    await getDb();
    const current = await User.findById(session.userId).select("fitnessProfile").lean();

    // A target that equals the automatic value is stored as "automatic", so
    // it keeps following weight and goal changes instead of going stale.
    const fitnessProfile = withoutRedundantTargets({
      ...((current?.fitnessProfile as Record<string, unknown>) || {}),
      ...data.fitnessProfile,
    }, data.fitnessProfile);

    const newKey = data.customGeminiApiKey?.trim();

    await updateUserProfile(session.userId, {
      name: data.name,
      fitnessProfile,
      preferences: data.preferences,
      ...(data.removeCustomGeminiApiKey
        ? { customGeminiApiKey: null }
        : newKey && newKey.length >= 10
          ? { customGeminiApiKey: newKey }
          : {}),
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("updateProfileSettingsAction:", err);
    return { success: false, error: publicErrorMessage(err) };
  }
}
