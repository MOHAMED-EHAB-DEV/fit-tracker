import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import Routine from "@/lib/db/models/Routine";
import PersonalRecord from "@/lib/db/models/PersonalRecord";
import LegacyWorkout from "@/lib/db/models/Workout";
import LegacyWorkoutTemplate from "@/lib/db/models/WorkoutTemplate";
import Meal from "@/lib/db/models/Meal";
import DailyLog from "@/lib/db/models/DailyLog";
import BodyComp from "@/lib/db/models/BodyComp";
import Habit from "@/lib/db/models/Habit";
import PlannedEvent from "@/lib/db/models/PlannedEvent";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import NutritionPlan from "@/lib/db/models/NutritionPlan";
import AssistantCommit from "@/lib/assistant/commit-model";
import { notFound } from "@/lib/api/errors";
import { parseCloudinaryUrl, type DeliveryType } from "@/lib/body-comp/public-id";
import { canTouchMealImage, isLegacySharedMealImage } from "@/lib/nutrition/image-rules";

/**
 * Removes a user and everything they own.
 *
 * Database deletes run in a transaction when the deployment supports one
 * (replica set / Atlas). On a standalone server they run children first and
 * the user document last, so a failure part-way leaves the account in place
 * and the delete can simply be retried. Cloudinary assets are collected
 * before the delete and destroyed after it; a failed destroy is logged and
 * reported, never fatal.
 */

export interface CloudinaryAsset {
  publicId: string;
  /** Cloudinary delivery type: "upload" (public), "private" or "authenticated". */
  type: DeliveryType;
}

export type DestroyAsset = (asset: CloudinaryAsset) => Promise<void>;

export interface DeleteUserReport {
  deleted: Record<string, number>;
  assets: { total: number; destroyed: number; failed: string[] };
  usedTransaction: boolean;
}

async function defaultDestroyAsset(asset: CloudinaryAsset): Promise<void> {
  const { default: cloudinary } = await import("@/lib/cloudinary");
  const result = (await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: "image",
    type: asset.type,
    invalidate: true,
  })) as { result?: string };
  // "not found" means it is already gone, which is the goal.
  if (result?.result && result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary answered "${result.result}"`);
  }
}

const DELIVERY_TYPES: ReadonlySet<string> = new Set(["upload", "private", "authenticated"]);

/**
 * Every Cloudinary asset that belongs to the user's documents.
 *
 * Meal images follow the same rule as deleting a single meal: only assets in
 * the user's own meal folder, or in the old shared meals folder and not used by
 * another user's meal (old versions accepted image ids from the browser, so a
 * stored id is not trusted to be the user's). Body photos keep their real
 * delivery type, recovered from legacy URLs where needed.
 */
export async function collectUserAssets(userId: mongoose.Types.ObjectId): Promise<CloudinaryAsset[]> {
  const [meals, checkIns] = await Promise.all([
    Meal.find({ userId, "images.0": { $exists: true } }).select("images.publicId images.deliveryType").lean(),
    BodyComp.find({ userId, "photos.0": { $exists: true } })
      .select("photos.cloudinaryPublicId photos.deliveryType photos.signedUrl")
      .lean(),
  ]);
  const owner = String(userId);
  const assets = new Map<string, CloudinaryAsset>();

  for (const meal of meals) {
    for (const image of meal.images || []) {
      const publicId = image?.publicId;
      if (!publicId || assets.has(publicId)) continue;
      if (!canTouchMealImage(publicId, owner)) {
        console.warn("[admin] not destroying a meal image outside the user's meal folder");
        continue;
      }
      if (isLegacySharedMealImage(publicId) && (await Meal.exists({ "images.publicId": publicId, userId: { $ne: userId } }))) {
        continue;
      }
      const type = image.deliveryType && DELIVERY_TYPES.has(image.deliveryType) ? (image.deliveryType as DeliveryType) : "upload";
      assets.set(publicId, { publicId, type });
    }
  }

  for (const checkIn of checkIns) {
    for (const photo of checkIn.photos || []) {
      const fromUrl = parseCloudinaryUrl(photo?.signedUrl);
      const publicId = photo?.cloudinaryPublicId || fromUrl?.publicId;
      if (!publicId || assets.has(publicId)) continue;
      const stored = photo?.deliveryType && DELIVERY_TYPES.has(photo.deliveryType) ? (photo.deliveryType as DeliveryType) : null;
      assets.set(publicId, { publicId, type: stored || fromUrl?.deliveryType || "private" });
    }
  }
  return Array.from(assets.values());
}

async function deleteDocuments(
  userId: mongoose.Types.ObjectId,
  session: ClientSession | null
): Promise<Record<string, number>> {
  const opts = session ? { session } : {};
  const counts: Record<string, number> = {};
  const run = async (label: string, work: Promise<{ deletedCount?: number; modifiedCount?: number }>) => {
    const result = await work;
    counts[label] = result.deletedCount ?? result.modifiedCount ?? 0;
  };

  // Children first (sequential: a transaction runs on one connection).
  await run("workoutSessions", WorkoutSession.deleteMany({ userId }, opts));
  await run("routines", Routine.deleteMany({ userId }, opts));
  await run("personalRecords", PersonalRecord.deleteMany({ userId }, opts));
  await run("legacyWorkouts", LegacyWorkout.deleteMany({ userId }, opts));
  // Old workout templates are no longer read by the app (routines replaced
  // them), and "public" was their default, so all of the user's go.
  await run("legacyTemplates", LegacyWorkoutTemplate.deleteMany({ createdBy: userId }, opts));
  await run("assistantCommits", AssistantCommit.deleteMany({ userId }, opts));
  await run("meals", Meal.deleteMany({ userId }, opts));
  await run("dailyLogs", DailyLog.deleteMany({ userId }, opts));
  await run("bodyComps", BodyComp.deleteMany({ userId }, opts));
  await run("habits", Habit.deleteMany({ userId }, opts));
  await run("plannedEvents", PlannedEvent.deleteMany({ userId }, opts));
  await run("customExercises", ExerciseCatalog.deleteMany({ isCustom: true, createdBy: userId }, opts));
  await run("planAssignments", NutritionPlan.updateMany({ assignedTo: userId }, { $pull: { assignedTo: userId } }, opts));
  await NutritionPlan.updateMany({ createdBy: userId }, { $set: { createdBy: null } }, opts);

  // The account itself last.
  await run("user", User.deleteOne({ _id: userId }, opts));
  return counts;
}

/** Transactions need a replica set or a sharded cluster (Atlas always is one). */
async function supportsTransactions(): Promise<boolean> {
  try {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    return Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    return false;
  }
}

export async function deleteUserCascade(
  userIdText: string,
  options: { destroyAsset?: DestroyAsset } = {}
): Promise<DeleteUserReport> {
  await getDb();
  const userId = new mongoose.Types.ObjectId(userIdText);
  const exists = await User.exists({ _id: userId });
  if (!exists) throw notFound("User not found");

  const assets = await collectUserAssets(userId);
  // Copies of meal photos that older versions cached through the public image proxy.
  const cachedMealPhotos = (await Meal.find({ userId, "images.secureUrl": { $type: "string" } }).select("images.secureUrl").lean())
    .flatMap((meal) => (meal.images || []).map((image) => image?.secureUrl))
    .filter((url): url is string => typeof url === "string" && url.startsWith("https://"));

  let deleted: Record<string, number>;
  const usedTransaction = await supportsTransactions();
  if (usedTransaction) {
    const session = await mongoose.startSession();
    try {
      let result: Record<string, number> = {};
      await session.withTransaction(async () => {
        result = await deleteDocuments(userId, session);
      });
      deleted = result;
    } finally {
      await session.endSession();
    }
  } else {
    deleted = await deleteDocuments(userId, null);
  }

  const destroy = options.destroyAsset || defaultDestroyAsset;
  const failed: string[] = [];
  for (const asset of assets) {
    try {
      await destroy(asset);
    } catch (err) {
      console.warn("[admin] could not destroy Cloudinary asset of a deleted user", asset.publicId, err);
      failed.push(asset.publicId);
    }
  }
  if (cachedMealPhotos.length && !options.destroyAsset) {
    const [{ getImageCacheKey }, { deleteSupabaseCachedImage }] = await Promise.all([
      import("@/lib/image-proxy/cache"),
      import("@/lib/image-proxy/supabase"),
    ]);
    for (const url of cachedMealPhotos) {
      try {
        await deleteSupabaseCachedImage(getImageCacheKey(new URL(url).href));
      } catch {
        // Best effort, like the asset destroys above.
      }
    }
  }

  return {
    deleted,
    assets: { total: assets.length, destroyed: assets.length - failed.length, failed },
    usedTransaction,
  };
}
