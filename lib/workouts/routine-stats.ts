import "server-only";
import mongoose from "mongoose";
import WorkoutSession from "@/lib/db/models/WorkoutSession";
import Routine from "@/lib/db/models/Routine";

/**
 * Rebuilds "last done" and "times done" of routines from their finished
 * workouts, so a back-dated log, an edited date or a deleted workout is
 * always reflected. Never incremented in place.
 */
export async function recomputeRoutineStats(userId: string, routineIds: ReadonlyArray<unknown>): Promise<void> {
  const ids = Array.from(new Set(routineIds.filter(Boolean).map(String))).filter((id) =>
    mongoose.isValidObjectId(id)
  );
  if (ids.length === 0) return;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const routineObjectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const stats = await WorkoutSession.aggregate<{ _id: mongoose.Types.ObjectId; count: number; last: Date | null }>([
    { $match: { userId: userObjectId, status: "completed", routineId: { $in: routineObjectIds } } },
    {
      $group: {
        _id: "$routineId",
        count: { $sum: 1 },
        last: { $max: { $ifNull: ["$endedAt", "$startedAt"] } },
      },
    },
  ]);
  const byId = new Map(stats.map((row) => [String(row._id), row]));

  await Routine.bulkWrite(
    routineObjectIds.map((routineId) => {
      const row = byId.get(String(routineId));
      return {
        updateOne: {
          filter: { _id: routineId, userId: userObjectId },
          update: { $set: { lastPerformedAt: row?.last ?? null, timesPerformed: row?.count ?? 0 } },
        },
      };
    }),
    { ordered: false }
  );
}
