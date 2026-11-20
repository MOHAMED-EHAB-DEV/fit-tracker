import "server-only";
import mongoose from "mongoose";
import { getDb } from "@/lib/db/mongoose";
import User from "@/lib/db/models/User";
import Routine from "@/lib/db/models/Routine";
import { badRequest } from "@/lib/api/errors";
import { ensureWorkoutsMigrated } from "@/lib/workouts/migrate";
import { orderedWeekdays, type WeekdayKey } from "@/lib/time";
import type { WeeklyScheduleDayDTO } from "@/lib/workouts/types";

/**
 * The weekly schedule: which routine (or rest) belongs to each weekday.
 * Days point at routines by id, so renaming a routine never breaks the plan.
 */
export async function getWeeklySchedule(userId: string, weekStartDay: WeekdayKey): Promise<WeeklyScheduleDayDTO[]> {
  await getDb();
  await ensureWorkoutsMigrated(userId);

  const user = await User.findById(userId).select("weeklyRoutine").lean();
  const stored = user?.weeklyRoutine || [];
  const routineIds = stored
    .map((day) => day.routineId)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
  const routines = await Routine.find({ _id: { $in: routineIds }, userId, archivedAt: null })
    .select("name")
    .lean();
  const nameById = new Map(routines.map((routine) => [String(routine._id), routine.name]));

  return orderedWeekdays(weekStartDay).map((dayOfWeek) => {
    const day = stored.find((entry) => entry.dayOfWeek === dayOfWeek);
    const routineId = day?.routineId ? String(day.routineId) : null;
    const routineName = routineId ? nameById.get(routineId) || null : null;
    return {
      dayOfWeek,
      routineId: routineName ? routineId : null,
      routineName,
      // A day with no routine and no explicit choice is shown as unplanned, not rest.
      isRestDay: Boolean(day?.isRestDay) && !routineName,
    };
  });
}

export async function setWeeklySchedule(
  userId: string,
  days: Array<{ dayOfWeek: string; routineId: string | null; isRestDay: boolean }>
): Promise<void> {
  await getDb();
  const routineIds = Array.from(new Set(days.map((day) => day.routineId).filter((id): id is string => Boolean(id))));
  const routines = await Routine.find({ _id: { $in: routineIds }, userId, archivedAt: null })
    .select("name exercises.muscleGroup")
    .lean();
  if (routines.length !== routineIds.length) throw badRequest("One of the routines no longer exists");
  const byId = new Map(routines.map((routine) => [String(routine._id), routine]));

  const weeklyRoutine = days.map((day) => {
    const routine = day.routineId ? byId.get(day.routineId) : null;
    return {
      dayOfWeek: day.dayOfWeek,
      workoutName: routine ? routine.name : day.isRestDay ? "Rest" : "Unplanned",
      isRestDay: !routine && day.isRestDay,
      targetMuscleGroups: routine
        ? Array.from(new Set(routine.exercises.map((exercise) => exercise.muscleGroup as string)))
        : [],
      routineId: routine ? new mongoose.Types.ObjectId(day.routineId as string) : null,
    };
  });

  await User.updateOne({ _id: userId }, { $set: { weeklyRoutine } }, { runValidators: true });
}
