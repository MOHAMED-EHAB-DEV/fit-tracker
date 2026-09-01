import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load environment variables from .env / .env.local
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=");
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not defined in environment.");
  process.exit(1);
}

function calculateSetCalories({
  reps,
  weight,
  metValue,
  userWeightKg,
  isWarmup = false,
  restSeconds = 0,
  weightUnit = "kg",
}) {
  if (reps <= 0 || metValue <= 0 || userWeightKg <= 0) return 0;
  const rawWeight = weight > 0 ? weight : 0;
  const weightInKg = weightUnit === "lbs" ? rawWeight / 2.20462 : rawWeight;

  const workDurationSeconds = reps * 3.5;
  const workDurationHours = workDurationSeconds / 3600;

  const effectiveMet = isWarmup ? metValue * 0.75 : metValue;
  const loadFactor = weightInKg > 0 ? 1 + (weightInKg / userWeightKg) * 0.15 : 1;

  const workCalories = effectiveMet * userWeightKg * workDurationHours * loadFactor;
  const restDurationHours = restSeconds > 0 ? restSeconds / 3600 : 0;
  const restCalories = restSeconds > 0 ? 2.0 * userWeightKg * restDurationHours : 0;

  return Math.round((workCalories + restCalories) * 10) / 10;
}

function calculateSessionDoneCalories(exercises, userWeightKg) {
  if (!userWeightKg || userWeightKg <= 0 || !Array.isArray(exercises)) return 0;
  let totalCalories = 0;

  for (const ex of exercises) {
    const met = Number(ex.metValue);
    if (!met || met <= 0) continue;

    const unit = ex.weightUnit;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];

    for (const s of sets) {
      const isCompleted = Boolean(s.completedAt || (s.completedReps && s.completedReps > 0));
      if (!isCompleted) continue;

      const reps = Number(s.completedReps) || 0;
      const weight = Number(s.weight) || 0;
      const restSeconds = Number(s.restSeconds) || 0;

      if (reps > 0) {
        totalCalories += calculateSetCalories({
          reps,
          weight,
          metValue: met,
          userWeightKg,
          isWarmup: Boolean(s.isWarmup),
          restSeconds,
          weightUnit: unit,
        });
      }
    }
  }

  return Math.round(totalCalories);
}

function calculateRoutinePlannedCalories(exercises, userWeightKg) {
  if (!userWeightKg || userWeightKg <= 0 || !Array.isArray(exercises)) return 0;
  let totalCalories = 0;

  for (const ex of exercises) {
    const met = Number(ex.metValue);
    if (!met || met <= 0) continue;

    const unit = ex.weightUnit;
    const sets = Array.isArray(ex.sets) ? ex.sets : [];

    for (const s of sets) {
      const reps = Number(s.targetReps) || 0;
      const weight = Number(s.targetWeight) || 0;
      const restSeconds = Number(s.restSeconds) || 0;

      if (reps > 0) {
        totalCalories += calculateSetCalories({
          reps,
          weight,
          metValue: met,
          userWeightKg,
          isWarmup: Boolean(s.isWarmup),
          restSeconds,
          weightUnit: unit,
        });
      }
    }
  }

  return Math.round(totalCalories);
}

function getTodayDateString(date = new Date(), timeZone = "Africa/Cairo") {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function run() {
  console.log("Connecting to database...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.");

  const db = mongoose.connection.db;

  const users = await db.collection("users").find({}).toArray();
  const userWeightMap = new Map();
  for (const u of users) {
    const weight = u.fitnessProfile?.weightKg || 0;
    userWeightMap.set(u._id.toString(), weight);
  }

  const catalog = await db.collection("exercisecatalogs").find({}).toArray();
  const catalogMetMap = new Map();
  for (const item of catalog) {
    if (item.metValue) {
      catalogMetMap.set(item._id.toString(), item.metValue);
    }
  }

  const workouts = await db.collection("workouts").find({}).toArray();
  console.log(`Found ${workouts.length} workouts to process.`);

  let updatedWorkouts = 0;

  for (const w of workouts) {
    const userWeight = userWeightMap.get(w.userId?.toString()) || 0;
    const isCompleted = w.status === "completed";

    let totalVolume = 0;
    const exercises = w.exercises || [];

    for (const ex of exercises) {
      if (!ex.metValue && ex.catalogId) {
        ex.metValue = catalogMetMap.get(ex.catalogId.toString());
      }

      const isLbs = (ex.weightUnit || w.weightUnit || "kg") === "lbs";
      if (Array.isArray(ex.sets)) {
        for (const s of ex.sets) {
          const reps = s.completedReps || (!isCompleted ? s.targetReps : null);
          const weight = s.weight !== null && s.weight !== undefined ? s.weight : (!isCompleted ? s.targetWeight : null);
          if (reps && weight) {
            const setVol = reps * weight;
            totalVolume += isLbs ? Math.round(setVol / 2.20462) : setVol;
          }
        }
      }
    }

    const calculatedCalories = isCompleted
      ? calculateSessionDoneCalories(exercises, userWeight)
      : calculateRoutinePlannedCalories(exercises, userWeight);

    await db.collection("workouts").updateOne(
      { _id: w._id },
      {
        $set: {
          exercises,
          estimatedCalories: calculatedCalories,
          totalVolume,
        },
      }
    );

    updatedWorkouts++;
  }

  console.log(`Updated ${updatedWorkouts} workouts with exact DB metValues.`);

  // Recalculate DailyLogs caloriesOut.workouts
  const dailyLogs = await db.collection("dailylogs").find({}).toArray();
  console.log(`Found ${dailyLogs.length} daily logs to sync.`);

  let updatedLogs = 0;

  for (const log of dailyLogs) {
    const userId = log.userId;
    const dateString = log.dateString;

    const completedWorkoutsForDay = await db
      .collection("workouts")
      .find({
        userId,
        status: "completed",
      })
      .toArray();

    const matchingWorkouts = completedWorkoutsForDay.filter((w) => {
      const wDateStr = getTodayDateString(w.completedAt || w.date || w.startedAt || w.createdAt);
      return wDateStr === dateString;
    });

    const totalWorkoutCalories = matchingWorkouts.reduce(
      (sum, w) => sum + (w.estimatedCalories || 0),
      0
    );

    const bmr = log.caloriesOut?.bmr || 0;
    const steps = log.caloriesOut?.steps || 0;
    const newTotalOut = bmr + steps + totalWorkoutCalories;

    await db.collection("dailylogs").updateOne(
      { _id: log._id },
      {
        $set: {
          "caloriesOut.workouts": totalWorkoutCalories,
          "caloriesOut.total": newTotalOut,
        },
      }
    );

    updatedLogs++;
  }

  console.log(`Synced ${updatedLogs} daily logs with exact DB workout calories.`);
  await mongoose.disconnect();
  console.log("Migration complete.");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
