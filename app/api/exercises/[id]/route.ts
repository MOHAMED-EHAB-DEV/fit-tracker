import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const queryName = searchParams.get("name")?.trim();

    await getDb();

    let exercise: any = null;

    // 1. Try lookup by ObjectId if valid
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      exercise = await ExerciseCatalog.findById(id).lean();
    }

    // 2. Try lookup by slug or exact name from the route param if not found
    if (!exercise && id && id !== "undefined" && id !== "null" && id !== "lookup") {
      const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      exercise = await ExerciseCatalog.findOne({
        $or: [
          { slug: id.toLowerCase() },
          { name: new RegExp(`^${safeId}$`, "i") },
        ],
      }).lean();
    }

    // 3. Try lookup by fallback name parameter if still not found
    if (!exercise && queryName) {
      const safeQueryName = queryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      exercise = await ExerciseCatalog.findOne({
        $or: [
          { name: new RegExp(`^${safeQueryName}$`, "i") },
          { slug: queryName.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
        ],
      }).lean();
    }

    // 4. Try partial match by queryName if exact match still didn't return
    if (!exercise && queryName) {
      const safeQueryName = queryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      exercise = await ExerciseCatalog.findOne({
        name: new RegExp(safeQueryName, "i"),
      }).lean();
    }

    if (!exercise) {
      return NextResponse.json({ success: false, error: "Exercise not found" }, { status: 404 });
    }

    // Clean instructions (remove empty strings, nulls, whitespace)
    const cleanInstructions = Array.isArray(exercise.instructions)
      ? exercise.instructions.filter((s: unknown) => typeof s === "string" && s.trim().length > 0)
      : [];

    // Clean images (remove empty strings, nulls, whitespace)
    const cleanImages = Array.isArray(exercise.images)
      ? exercise.images.filter((img: unknown) => typeof img === "string" && img.trim().length > 0)
      : [];

    return NextResponse.json({
      success: true,
      exercise: {
        ...exercise,
        _id: exercise._id.toString(),
        instructions: cleanInstructions,
        images: cleanImages,
        createdBy: exercise.createdBy ? exercise.createdBy.toString() : null,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    console.error("Exercise [id] GET route error:", err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
