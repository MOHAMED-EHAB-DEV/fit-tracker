import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import { withAPIMiddleware } from "@/lib/api/middleware";

async function handleGetExercises(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || undefined;
    const muscle = searchParams.get("muscle")?.trim() || undefined;
    const category = searchParams.get("category")?.trim() || undefined;
    const equipment = searchParams.get("equipment")?.trim() || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "60", 10)));

    await getDb();

    // Query both global exercises and user-created custom exercises
    const filter: Record<string, unknown> = {
      $or: [
        { isCustom: false },
        { isCustom: true, createdBy: session.userId },
      ],
    };

    if (query) {
      const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safeQuery, "i");
      filter.$and = [
        {
          $or: [
            { name: regex },
            { primaryMuscle: regex },
            { secondaryMuscles: regex },
            { equipment: regex },
            { category: regex },
          ],
        },
      ];
    }

    if (muscle && muscle !== "all") {
      filter.primaryMuscle = new RegExp(`^${muscle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }

    if (category && category !== "all") {
      filter.category = new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }

    if (equipment && equipment !== "all") {
      filter.equipment = new RegExp(`^${equipment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }

    const includeInstructions = searchParams.get("include")?.includes("instructions") || searchParams.get("fields")?.includes("instructions");
    const includeImages = searchParams.get("include")?.includes("images") || searchParams.get("fields")?.includes("images");

    // Build projection: exclude heavy instructions and images by default for ultra-fast list responses
    let projection = "";
    if (!includeInstructions && !includeImages) {
      projection = "-instructions -images";
    } else if (!includeInstructions) {
      projection = "-instructions";
    } else if (!includeImages) {
      projection = "-images";
    }

    const [exercises, total] = await Promise.all([
      ExerciseCatalog.find(filter)
        .select(projection)
        .sort({ isCustom: -1, name: 1 })
        .limit(limit)
        .lean(),
      ExerciseCatalog.countDocuments(filter),
    ]);

    const formatted = exercises.map((e) => ({
      ...e,
      _id: e._id.toString(),
    }));

    return NextResponse.json({
      success: true,
      exercises: formatted,
      count: formatted.length,
      total,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Exercises GET route error:", err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

async function handleCreateExercise(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, primaryMuscle, secondaryMuscles, equipment, category, instructions } = body;

    if (!name || !primaryMuscle || !equipment || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required exercise fields" },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    await getDb();

    const exercise = await ExerciseCatalog.create({
      name: name.trim(),
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      primaryMuscle: primaryMuscle.trim(),
      secondaryMuscles: secondaryMuscles || [],
      equipment,
      category,
      instructions: Array.isArray(instructions) ? instructions : [],
      isCustom: true,
      createdBy: session.userId,
    });

    return NextResponse.json({ success: true, exercise }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Exercises POST route error:", err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

// Export wrapped handlers with high-speed in-memory map search caching & rate limiting
export const GET = withAPIMiddleware(handleGetExercises, {
  routeName: "exercises",
  cache: {
    enabled: true,
    ttlMs: 60 * 5000, // 5 min cache TTL for fast lookups
    scope: "user", // user-scoped to keep custom exercises segregated
    tags: ["exercises"],
  },
  rateLimit: {
    enabled: true,
    limit: 60, // 60 requests per minute
    windowMs: 60 * 1000,
  },
});

export const POST = withAPIMiddleware(handleCreateExercise, {
  routeName: "exercises",
  autoInvalidateOnMutation: true, // Automatically clears "exercises" search cache on mutation
  tags: ["exercises"],
  rateLimit: {
    enabled: true,
    limit: 30, // 30 exercise creations per minute
    windowMs: 60 * 1000,
  },
});

