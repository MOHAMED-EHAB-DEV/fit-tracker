#!/usr/bin/env node
/**
 * Runs the app on this machine against a throwaway in-memory MongoDB.
 *
 *   node scripts/dev-local.mjs                    development server (or: bun run dev:local)
 *   node scripts/dev-local.mjs --prod             production build, then `next start` (or: bun run start:local)
 *   node scripts/dev-local.mjs --prod --no-build  `next start` on the last local production build
 *   --port=3101                                   another port (default 3100, or the PORT variable)
 *
 * Nothing here touches the real database or the real third-party accounts:
 *  - MONGODB_URI is replaced with a local in-memory server that is deleted
 *    when the script stops;
 *  - the session secret and the Gemini / Cloudinary / Supabase / email keys
 *    are replaced with local placeholders, so AI and photo uploads fail with
 *    a clear message instead of calling the real services;
 *  - Next.js writes to `.next-local` instead of `.next`, so a build made with
 *    the placeholder keys is never mistaken for a real one, and this can run
 *    beside a normal `next dev`.
 *
 * A small exercise library and one demo account are created on every start.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let port = Number(process.env.PORT || 3100);
let production = false;
let skipBuild = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--prod") production = true;
  else if (arg === "--no-build") skipBuild = true;
  else if (/^--port=\d{2,5}$/.test(arg)) port = Number(arg.slice("--port=".length));
  else {
    console.error(`Unknown option "${arg}". Use --prod, --no-build and/or --port=<number>.`);
    process.exit(2);
  }
}

/** Local-only demo account (also an admin, so the admin panel can be opened). */
const DEMO_USER = {
  name: "Demo User",
  email: "demo@fittracker.test",
  password: "local-demo-2026",
};

const normalize = (name) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** [name, primary muscle, equipment, category, MET] */
const EXERCISES = [
  ["Barbell Bench Press", "Chest", "barbell", "strength", 6],
  ["Incline Dumbbell Press", "Chest", "dumbbell", "strength", 6],
  ["Dumbbell Bench Press", "Chest", "dumbbell", "strength", 6],
  ["Cable Crossover", "Chest", "cable", "strength", 5],
  ["Push-Up", "Chest", "bodyweight", "strength", 5],
  ["Overhead Press", "Shoulders", "barbell", "strength", 6],
  ["Dumbbell Shoulder Press", "Shoulders", "dumbbell", "strength", 6],
  ["Dumbbell Lateral Raise", "Shoulders", "dumbbell", "strength", 4],
  ["Face Pull", "Shoulders", "cable", "strength", 4],
  ["Tricep Rope Pushdown", "Triceps", "cable", "strength", 4],
  ["Close-Grip Barbell Bench Press", "Triceps", "barbell", "strength", 6],
  ["Dips", "Triceps", "bodyweight", "strength", 6],
  ["Lat Pulldown", "Lats", "cable", "strength", 5],
  ["Pull-Up", "Lats", "bodyweight", "strength", 7],
  ["Bent Over Barbell Row", "Middle Back", "barbell", "strength", 6],
  ["Seated Cable Row", "Middle Back", "cable", "strength", 5],
  ["Barbell Deadlift", "Lower Back", "barbell", "powerlifting", 7],
  ["Barbell Curl", "Biceps", "barbell", "strength", 4],
  ["Incline Dumbbell Curl", "Biceps", "dumbbell", "strength", 4],
  ["Hammer Curl", "Biceps", "dumbbell", "strength", 4],
  ["Barbell Squat", "Quadriceps", "barbell", "powerlifting", 7],
  ["Leg Press", "Quadriceps", "machine", "strength", 6],
  ["Leg Extension", "Quadriceps", "machine", "strength", 4],
  ["Dumbbell Lunges", "Quadriceps", "dumbbell", "strength", 6],
  ["Romanian Deadlift", "Hamstrings", "barbell", "strength", 6],
  ["Seated Leg Curl", "Hamstrings", "machine", "strength", 4],
  ["Hip Thrust", "Glutes", "barbell", "strength", 6],
  ["Standing Calf Raise", "Calves", "machine", "strength", 4],
  ["Plank", "Abdominals", "bodyweight", "strength", 4],
  ["Hanging Leg Raise", "Abdominals", "bodyweight", "strength", 5],
  ["Cable Crunch", "Abdominals", "cable", "strength", 4],
  ["Ab Roller", "Abdominals", "other", "strength", 5],
  ["Treadmill Running", "Quadriceps", "machine", "cardio", 9],
  ["Stationary Bike", "Quadriceps", "machine", "cardio", 7],
  ["Rowing Machine", "Middle Back", "machine", "cardio", 7],
  ["Jump Rope", "Calves", "other", "cardio", 11],
  ["Hamstring Stretch", "Hamstrings", "bodyweight", "stretching", 2.5],
];

async function seed(uri) {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const now = new Date();

  await db.collection("exercisecatalogs").insertMany(
    EXERCISES.map(([name, primaryMuscle, equipment, category, metValue]) => ({
      name,
      // Left out on purpose: muscleGroup and trackingType are derived by the app.
      normalizedName: "",
      slug: normalize(name).replace(/ /g, "-"),
      primaryMuscle,
      secondaryMuscles: [],
      equipment,
      category,
      instructions: [`Demo entry for "${name}". The real library has full instructions.`],
      images: [],
      metValue,
      isCustom: false,
      createdBy: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }))
  );

  await db.collection("users").insertOne({
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    passwordHash: await bcrypt.hash(DEMO_USER.password, 10),
    role: "admin",
    isBanned: false,
    tokenVersion: 0,
    isProfileComplete: true,
    fitnessProfile: {
      sex: "male",
      birthDate: new Date("1996-05-14T00:00:00.000Z"),
      age: 30,
      weightKg: 82,
      heightCm: 178,
      activityLevel: "moderate",
      goal: "maintain",
      targetCalories: null,
      targetProteinG: null,
      targetCarbsG: null,
      targetFatG: null,
      targetFiberG: null,
      calorieAdjustment: null,
    },
    preferences: {
      stepGoal: 8000,
      waterGoalMl: 2750,
      weekStartDay: "saturday",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo",
      weightUnit: "kg",
      restTimerDefaultSec: 90,
      customGeminiApiKey: null,
    },
    migrations: { workoutsV3At: now },
    weeklyRoutine: [],
    computed: {},
    createdAt: now,
    updatedAt: now,
  });

  await mongoose.disconnect();
}

const database = await MongoMemoryServer.create();
const uri = database.getUri("fit-tracker-local");
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
  await database.stop();
  throw new Error(`Refusing to start: "${uri}" is not a local database.`);
}
await seed(uri);

console.log(`\n  Local database: ${uri}`);
console.log(`  Demo account:   ${DEMO_USER.email}  (password in scripts/dev-local.mjs)`);
console.log(`  Mode:           ${production ? "production (next start)" : "development (next dev)"}`);
console.log(`  App:            http://localhost:${port}\n`);

const env = {
  ...process.env,
  // Variables already set here win over the .env file, so the real values are never used.
  FIT_TRACKER_DIST_DIR: ".next-local",
  NEXT_TELEMETRY_DISABLED: "1",
  MONGODB_URI: uri,
  JWT_SECRET: "local-dev-session-secret-not-used-anywhere-else",
  DATA_ENCRYPTION_KEY: "local-dev-data-key-not-used-anywhere-else",
  APP_URL: `http://localhost:${port}`,
  GEMINI_API_KEY: "local-placeholder",
  CLOUDINARY_CLOUD_NAME: "local-placeholder",
  CLOUDINARY_API_KEY: "local-placeholder",
  CLOUDINARY_API_SECRET: "local-placeholder",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_SERVICE_ROLE_KEY: "local-placeholder",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
};
// `next build` / `next start` set NODE_ENV themselves.
delete env.NODE_ENV;

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
let child = null;
let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (child && child.exitCode === null) child.kill();
  await database.stop().catch(() => undefined);
  process.exit(code);
}

process.on("SIGINT", () => void stop(0));
process.on("SIGTERM", () => void stop(0));

function runNext(nextArgs) {
  child = spawn(process.execPath, [nextBin, ...nextArgs], { cwd: root, stdio: "inherit", env });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

if (production && !skipBuild) {
  const buildCode = await runNext(["build"]);
  if (buildCode !== 0) {
    console.error(`\n  The production build failed (exit code ${buildCode}).`);
    await stop(buildCode);
  }
}

const exitCode = await runNext(production ? ["start", "-p", String(port)] : ["dev", "-p", String(port)]);
await stop(exitCode);
