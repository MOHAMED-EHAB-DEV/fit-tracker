import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/mongoose";
import WorkoutTemplate from "@/lib/db/models/WorkoutTemplate";
import { withAPIMiddleware } from "@/lib/api/middleware";

async function handleGetTemplates() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await getDb();

    // Fetch public community templates and templates created by this user
    const templates = await WorkoutTemplate.find({
      $or: [{ isPublic: true }, { createdBy: session.userId }],
    })
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, templates });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

async function handleCreateTemplate(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, category, daysPerWeek, exercises, isPublic } = body;

    if (!name || !category || !daysPerWeek || !exercises) {
      return NextResponse.json({ success: false, error: "Missing required template fields" }, { status: 400 });
    }

    await getDb();

    const template = await WorkoutTemplate.create({
      createdBy: session.userId,
      name: name.trim(),
      description: description || "",
      category,
      daysPerWeek: Number(daysPerWeek),
      exercises,
      isPublic: isPublic ?? true,
      usageCount: 0,
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export const GET = withAPIMiddleware(handleGetTemplates, {
  routeName: "workout-templates",
  cache: {
    enabled: true,
    ttlMs: 60 * 1000,
    scope: "user",
    tags: ["workout-templates"],
  },
  rateLimit: {
    enabled: true,
    limit: 60,
    windowMs: 60 * 1000,
  },
});

export const POST = withAPIMiddleware(handleCreateTemplate, {
  routeName: "workout-templates",
  autoInvalidateOnMutation: true,
  tags: ["workout-templates"],
  rateLimit: {
    enabled: true,
    limit: 20,
    windowMs: 60 * 1000,
  },
});


