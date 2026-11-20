import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import User, { type IUser } from "@/lib/db/models/User";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import Meal from "@/lib/db/models/Meal";
import BodyComp from "@/lib/db/models/BodyComp";
import { HttpError, badRequest, conflict, notFound } from "@/lib/api/errors";
import { updateUserProfile } from "@/lib/users/profile";
import { randomToken, sha256Hex } from "@/lib/security/secrets";
import { escapeRegex, type AdminUserPatch, type UserListQuery } from "@/lib/validation/admin";
import { deleteUserCascade, type DeleteUserReport, type DestroyAsset } from "@/lib/admin/delete-user";

/** User management for the admin panel. Responses only ever carry the fields below. */

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isBanned: boolean;
  isProfileComplete: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  goal: string | null;
}

export interface AdminUserDetail extends AdminUserRow {
  fitnessProfile: {
    sex: string | null;
    age: number | null;
    weightKg: number | null;
    heightCm: number | null;
    activityLevel: string | null;
    goal: string | null;
    targetCalories: number | null;
    targetProteinG: number | null;
  };
  preferences: {
    stepGoal: number | null;
    waterGoalMl: number | null;
    timezone: string;
    weightUnit: string;
  };
  computed: { bmr: number | null; tdee: number | null };
}

export interface AdminUserStats {
  completedWorkouts: number;
  meals: number;
  checkIns: number;
}

/** Fields a list or detail view may read. Secrets are never selected. */
const SAFE_FIELDS =
  "name email role isBanned isProfileComplete createdAt lastLoginAt fitnessProfile preferences.stepGoal preferences.waterGoalMl preferences.timezone preferences.weightUnit computed.bmr computed.tdee";

type SafeUser = Pick<IUser, "name" | "email" | "role" | "isBanned" | "isProfileComplete" | "lastLoginAt" | "createdAt"> & {
  _id: unknown;
  fitnessProfile?: Partial<IUser["fitnessProfile"]>;
  preferences?: Partial<IUser["preferences"]>;
  computed?: Partial<IUser["computed"]>;
};

const iso = (value: Date | null | undefined) => (value ? new Date(value).toISOString() : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Same rule the session uses to treat a profile as complete. */
function profileComplete(user: SafeUser): boolean {
  const profile = user.fitnessProfile;
  return Boolean(user.isProfileComplete || (profile?.weightKg && profile?.heightCm && profile?.sex));
}

export function toAdminUserRow(user: SafeUser): AdminUserRow {
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    role: user.role === "admin" ? "admin" : "user",
    isBanned: Boolean(user.isBanned),
    isProfileComplete: profileComplete(user),
    createdAt: iso(user.createdAt),
    lastLoginAt: iso(user.lastLoginAt),
    goal: user.fitnessProfile?.goal || null,
  };
}

export function toAdminUserDetail(user: SafeUser): AdminUserDetail {
  const profile = user.fitnessProfile || {};
  const preferences = user.preferences || {};
  return {
    ...toAdminUserRow(user),
    fitnessProfile: {
      sex: profile.sex || null,
      age: num(profile.age),
      weightKg: num(profile.weightKg),
      heightCm: num(profile.heightCm),
      activityLevel: profile.activityLevel || null,
      goal: profile.goal || null,
      targetCalories: num(profile.targetCalories),
      targetProteinG: num(profile.targetProteinG),
    },
    preferences: {
      stepGoal: num(preferences.stepGoal),
      waterGoalMl: num(preferences.waterGoalMl),
      timezone: preferences.timezone || "",
      weightUnit: preferences.weightUnit || "kg",
    },
    computed: { bmr: num(user.computed?.bmr), tdee: num(user.computed?.tdee) },
  };
}

function objectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid user id");
  return new mongoose.Types.ObjectId(id);
}

/** Ids from the URL may use upper-case hex; compare them in one canonical form. */
function sameId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

export async function listAdminUsers(query: UserListQuery) {
  await getDb();
  const filter: Record<string, unknown> = {};
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  if (query.role) filter.role = query.role;
  if (query.isBanned) filter.isBanned = query.isBanned === "true" ? true : { $ne: true };

  const direction = query.sortDir === "asc" ? 1 : -1;
  const [users, total, activeAdmins] = await Promise.all([
    User.find(filter)
      .select(SAFE_FIELDS)
      .collation(CASE_INSENSITIVE)
      .sort({ [query.sortField]: direction, _id: direction })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
    countActiveAdmins(),
  ]);

  return {
    users: (users as unknown as SafeUser[]).map(toAdminUserRow),
    /** Lets the UI disable demote/ban/delete on the last admin who can sign in. */
    activeAdmins,
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/** Admins who can still sign in. */
export async function countActiveAdmins(): Promise<number> {
  await getDb();
  return User.countDocuments({ role: "admin", isBanned: { $ne: true } });
}

export interface UserPermissions {
  isSelf: boolean;
  /** This is the only admin who can still sign in. */
  isLastActiveAdmin: boolean;
  canChangeRole: boolean;
  canBan: boolean;
  canDelete: boolean;
}

export async function permissionsFor(actorId: string, target: { id: string; role: string; isBanned: boolean }): Promise<UserPermissions> {
  const isSelf = sameId(actorId, target.id);
  const isActiveAdmin = target.role === "admin" && !target.isBanned;
  const isLastActiveAdmin = isActiveAdmin && (await countActiveAdmins()) <= 1;
  return {
    isSelf,
    isLastActiveAdmin,
    canChangeRole: !isSelf && !isLastActiveAdmin,
    canBan: !isSelf && !isLastActiveAdmin,
    canDelete: !isSelf && !isLastActiveAdmin,
  };
}

export async function getAdminUserDetail(actorId: string, id: string) {
  const userId = objectId(id);
  await getDb();
  const user = (await User.findById(userId).select(SAFE_FIELDS).lean()) as SafeUser | null;
  if (!user) throw notFound("User not found");

  const [completedWorkouts, meals, checkIns] = await Promise.all([
    WorkoutSession.countDocuments({ userId, status: "completed" }),
    Meal.countDocuments({ userId }),
    BodyComp.countDocuments({ userId }),
  ]);
  const detail = toAdminUserDetail(user);
  return {
    user: detail,
    stats: { completedWorkouts, meals, checkIns } satisfies AdminUserStats,
    permissions: await permissionsFor(actorId, detail),
  };
}

const LAST_ADMIN_MESSAGE =
  "This is the only admin who can sign in. Promote another user to admin first, so the panel is never left without one.";

/**
 * Throws when an admin action would lock the panel: acting on your own
 * role/ban/account, or removing the last admin who can sign in.
 */
export async function assertAdminChangeAllowed(
  actorId: string,
  target: { id: string; role: string; isBanned: boolean },
  change: { role?: "user" | "admin"; isBanned?: boolean; delete?: boolean }
): Promise<void> {
  const isSelf = sameId(actorId, target.id);
  if (isSelf && change.delete) throw badRequest("You cannot delete your own account from the admin panel.");
  if (isSelf && change.role !== undefined && change.role !== target.role) {
    throw badRequest("You cannot change your own role. Ask another admin to do it.");
  }
  if (isSelf && change.isBanned === true) throw badRequest("You cannot ban yourself.");

  const removesAdmin =
    target.role === "admin" &&
    !target.isBanned &&
    (change.delete || change.isBanned === true || (change.role !== undefined && change.role !== "admin"));
  if (removesAdmin && (await countActiveAdmins()) <= 1) throw conflict(LAST_ADMIN_MESSAGE);
}

export async function updateUserAsAdmin(actorId: string, id: string, patch: AdminUserPatch) {
  const userId = objectId(id);
  await getDb();
  const before = (await User.findById(userId).select("role isBanned").lean()) as Pick<IUser, "role" | "isBanned"> | null;
  if (!before) throw notFound("User not found");
  const canonicalId = String(userId);
  const target = { id: canonicalId, role: before.role, isBanned: Boolean(before.isBanned) };

  await assertAdminChangeAllowed(actorId, target, { role: patch.role, isBanned: patch.isBanned });

  const set: Record<string, unknown> = {};
  let signOut = false;
  if (patch.role !== undefined && patch.role !== before.role) {
    set.role = patch.role;
    // A demoted admin's open sessions should not keep admin rights cached anywhere.
    if (patch.role === "user") signOut = true;
  }
  if (patch.isBanned !== undefined && patch.isBanned !== Boolean(before.isBanned)) {
    set.isBanned = patch.isBanned;
    // Sign the user out everywhere (sessions are also checked for the ban).
    if (patch.isBanned) signOut = true;
  }

  if (Object.keys(set).length) {
    await User.updateOne({ _id: userId }, { $set: set });

    // Two admins demoting/banning each other at the same moment can both pass
    // the check above; if that left no admin, undo this change (nothing else
    // has been written yet).
    if ((set.role === "user" || set.isBanned === true) && (await countActiveAdmins()) === 0) {
      await User.updateOne({ _id: userId }, { $set: { role: before.role, isBanned: Boolean(before.isBanned) } });
      throw conflict(LAST_ADMIN_MESSAGE);
    }
    if (signOut) await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  }

  // Profile fields go through the one profile writer (recomputes BMR/TDEE/targets),
  // only once the role/ban change above is known to stand.
  if (patch.name !== undefined || patch.fitnessProfile || patch.preferences) {
    await updateUserProfile(canonicalId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.fitnessProfile ? { fitnessProfile: patch.fitnessProfile } : {}),
      ...(patch.preferences ? { preferences: patch.preferences } : {}),
    });
  }

  return getAdminUserDetail(actorId, canonicalId);
}

export async function deleteUserAsAdmin(
  actorId: string,
  id: string,
  options: { destroyAsset?: DestroyAsset } = {}
): Promise<DeleteUserReport> {
  const userId = objectId(id);
  await getDb();
  const before = (await User.findById(userId).select("role isBanned").lean()) as Pick<IUser, "role" | "isBanned"> | null;
  if (!before) throw notFound("User not found");
  const canonicalId = String(userId);
  await assertAdminChangeAllowed(actorId, { id: canonicalId, role: before.role, isBanned: Boolean(before.isBanned) }, { delete: true });

  // Lock the account before its data is removed: its sessions stop working at
  // once (nothing new can be written during the cascade), and it no longer
  // counts as an admin, so two admins deleting each other cannot both succeed.
  await User.updateOne({ _id: userId }, { $set: { isBanned: true } });
  if (before.role === "admin" && !before.isBanned && (await countActiveAdmins()) === 0) {
    await User.updateOne({ _id: userId }, { $set: { isBanned: false } });
    throw conflict(LAST_ADMIN_MESSAGE);
  }
  return deleteUserCascade(canonicalId, options);
}

export const RESET_LINK_MINUTES = 30;

/**
 * Creates a one-time password reset link for a user (for deployments without
 * an email provider). The token is only stored hashed; the link is returned once.
 */
export async function createPasswordResetLink(id: string, baseUrl: string): Promise<{ link: string; expiresAt: string }> {
  const userId = objectId(id);
  await getDb();
  const user = await User.findById(userId).select("isBanned").lean();
  if (!user) throw notFound("User not found");
  if (user.isBanned) throw new HttpError(409, "This user is banned. Unban them before creating a reset link.");

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + RESET_LINK_MINUTES * 60_000);
  await User.updateOne(
    { _id: userId },
    { $set: { passwordResetTokenHash: sha256Hex(token), passwordResetExpiresAt: expiresAt } }
  );
  return {
    link: `${baseUrl.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString(),
  };
}
