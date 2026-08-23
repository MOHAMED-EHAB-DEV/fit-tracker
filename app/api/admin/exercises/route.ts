import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import cloudinary from "@/lib/cloudinary";

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
  const search = searchParams.get("search") || "";
  const muscle = searchParams.get("muscle") || "";
  const equipment = searchParams.get("equipment") || "";
  const category = searchParams.get("category") || "";
  const level = searchParams.get("level") || "";
  const isCustom = searchParams.get("isCustom") || "";
  const sortField = searchParams.get("sortField") || "name";
  const sortDir = searchParams.get("sortDir") === "desc" ? -1 : 1;

  await getDb();

  const filter: any = {};
  if (search) filter.$text = { $search: search };
  if (muscle && muscle !== "all") filter.primaryMuscle = new RegExp(muscle, "i");
  if (equipment && equipment !== "all") filter.equipment = new RegExp(equipment, "i");
  if (category && category !== "all") filter.category = new RegExp(category, "i");
  if (level && level !== "all") filter.level = level;
  if (isCustom !== "") filter.isCustom = isCustom === "true";

  const validSort: Record<string, string> = {
    name: "name",
    primaryMuscle: "primaryMuscle",
    equipment: "equipment",
    category: "category",
    metValue: "metValue",
    createdAt: "createdAt",
  };
  const sort: any = { [validSort[sortField] || "name"]: sortDir };

  const [exercises, total] = await Promise.all([
    ExerciseCatalog.find(filter)
      .select("-instructions -images")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ExerciseCatalog.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    exercises,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request);
    if (result instanceof NextResponse) return result;

    const contentType = request.headers.get("content-type") || "";
    let name = "";
    let primaryMuscle = "";
    let secondaryMuscles: string[] = [];
    let equipment = "other";
    let category = "strength";
    let force: string | null = null;
    let level: string | null = null;
    let mechanic: string | null = null;
    let metValue: number = 5.0;
    let instructions: string[] = [];
    let images: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      name = (formData.get("name") as string || "").trim();
      primaryMuscle = (formData.get("primaryMuscle") as string || "").trim();
      equipment = (formData.get("equipment") as string) || "other";
      category = (formData.get("category") as string) || "strength";
      force = (formData.get("force") as string) || null;
      level = (formData.get("level") as string) || null;
      mechanic = (formData.get("mechanic") as string) || null;
      const rawMet = formData.get("metValue");
      metValue = rawMet != null && rawMet !== "" ? parseFloat(String(rawMet)) || 5.0 : 5.0;

      const rawSecondary = formData.get("secondaryMuscles");
      if (typeof rawSecondary === "string") {
        try {
          secondaryMuscles = JSON.parse(rawSecondary);
        } catch {
          secondaryMuscles = [];
        }
      }

      const rawInstructions = formData.get("instructions");
      if (typeof rawInstructions === "string") {
        try {
          instructions = JSON.parse(rawInstructions);
        } catch {
          instructions = [];
        }
      }

      // Handle file uploads to Cloudinary
      const rawFiles = formData.getAll("files") as (File | string)[];
      const files = rawFiles.filter((f): f is File => typeof f !== "string" && f && f.size > 0);

      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          return NextResponse.json(
            { success: false, error: `Invalid file type: ${file.type}. Only images are allowed.` },
            { status: 400 }
          );
        }
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: `File ${file.name} exceeds 10MB limit.` },
            { status: 400 }
          );
        }

        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const dataUri = `data:${file.type};base64,${base64}`;
        const isGif = file.type === "image/gif";

        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: "fit-tracker/exercises",
          resource_type: "image",
          ...(isGif ? {} : { format: "webp" }),
        });

        if (uploadResult?.secure_url) {
          uploadedUrls.push(uploadResult.secure_url);
        }
      }

      // Reassemble images using imageManifest if available
      const rawManifest = formData.get("imageManifest");
      if (typeof rawManifest === "string") {
        try {
          const manifest: Array<{ type: "url" | "file"; url?: string; fileIndex?: number }> = JSON.parse(rawManifest);
          const finalImages: string[] = [];
          for (const entry of manifest) {
            if (entry.type === "url" && entry.url) {
              finalImages.push(entry.url);
            } else if (entry.type === "file" && typeof entry.fileIndex === "number" && uploadedUrls[entry.fileIndex]) {
              finalImages.push(uploadedUrls[entry.fileIndex]);
            }
          }
          images = finalImages;
        } catch (e) {
          console.error("Failed to parse imageManifest:", e);
        }
      } else {
        const rawExisting = formData.getAll("images") as string[];
        images = [...rawExisting.filter(Boolean), ...uploadedUrls];
      }
    } else {
      const body = await request.json().catch(() => ({}));
      name = (body.name || "").trim();
      primaryMuscle = (body.primaryMuscle || "").trim();
      secondaryMuscles = Array.isArray(body.secondaryMuscles) ? body.secondaryMuscles : [];
      equipment = body.equipment || "other";
      category = body.category || "strength";
      force = body.force || null;
      level = body.level || null;
      mechanic = body.mechanic || null;
      metValue = body.metValue != null ? Number(body.metValue) || 5.0 : 5.0;
      instructions = Array.isArray(body.instructions) ? body.instructions : [];
      images = Array.isArray(body.images) ? body.images : [];

      if (images.length > 0) {
        images = await Promise.all(
          images.map(async (img: string) => {
            if (typeof img === "string" && img.startsWith("data:image/")) {
              const uploadResult = await cloudinary.uploader.upload(img, {
                folder: "fit-tracker/exercises",
                resource_type: "image",
                format: "webp",
              });
              return uploadResult.secure_url;
            }
            return img;
          })
        );
      }
    }

    if (!name || !primaryMuscle || !equipment || !category) {
      return NextResponse.json(
        { success: false, error: "name, primaryMuscle, equipment, and category are required" },
        { status: 400 }
      );
    }

    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      `-${Date.now().toString().slice(-6)}`;

    await getDb();

    const exercise = await ExerciseCatalog.create({
      name,
      slug,
      primaryMuscle,
      secondaryMuscles,
      equipment,
      category,
      force: (force as "pull" | "push" | "static") || null,
      level: (level as "beginner" | "intermediate" | "expert") || null,
      mechanic: (mechanic as "compound" | "isolation") || null,
      metValue,
      instructions,
      images,
      isCustom: false, // Admin-created = global, not custom
      createdBy: (result.user as any)._id,
    });

    return NextResponse.json({ success: true, exercise }, { status: 201 });
  } catch (err: unknown) {
    console.error("Exercise create error:", err);
    const message = err instanceof Error ? err.message : "Failed to create exercise";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
