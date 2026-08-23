import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/mongoose";
import ExerciseCatalog from "@/lib/db/models/ExerciseCatalog";
import cloudinary from "@/lib/cloudinary";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid exercise ID" }, { status: 400 });
  }

  await getDb();
  const exercise = await ExerciseCatalog.findById(id).lean();
  if (!exercise) {
    return NextResponse.json({ success: false, error: "Exercise not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, exercise });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const result = await requireAdmin(request);
    if (result instanceof NextResponse) return result;

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: "Invalid exercise ID" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") || "";
    const updateData: Record<string, any> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      if (formData.has("name")) updateData.name = (formData.get("name") as string).trim();
      if (formData.has("primaryMuscle")) updateData.primaryMuscle = (formData.get("primaryMuscle") as string).trim();
      if (formData.has("equipment")) updateData.equipment = formData.get("equipment") as string;
      if (formData.has("category")) updateData.category = formData.get("category") as string;
      if (formData.has("force")) updateData.force = (formData.get("force") as string) || null;
      if (formData.has("level")) updateData.level = (formData.get("level") as string) || null;
      if (formData.has("mechanic")) updateData.mechanic = (formData.get("mechanic") as string) || null;
      if (formData.has("metValue")) {
        const mv = formData.get("metValue");
        updateData.metValue = mv != null && mv !== "" ? parseFloat(String(mv)) : 5.0;
      }

      if (formData.has("secondaryMuscles")) {
        const rawSecondary = formData.get("secondaryMuscles");
        if (typeof rawSecondary === "string") {
          try {
            updateData.secondaryMuscles = JSON.parse(rawSecondary);
          } catch {
            updateData.secondaryMuscles = [];
          }
        }
      }

      if (formData.has("instructions")) {
        const rawInstructions = formData.get("instructions");
        if (typeof rawInstructions === "string") {
          try {
            updateData.instructions = JSON.parse(rawInstructions);
          } catch {
            updateData.instructions = [];
          }
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
          updateData.images = finalImages;
        } catch (e) {
          console.error("Failed to parse imageManifest:", e);
        }
      } else if (formData.has("images") || uploadedUrls.length > 0) {
        const rawExisting = formData.getAll("images") as string[];
        updateData.images = [...rawExisting.filter(Boolean), ...uploadedUrls];
      }
    } else {
      // JSON body support
      const body = await request.json().catch(() => ({}));

      const allowed = [
        "name", "primaryMuscle", "secondaryMuscles", "equipment", "category",
        "force", "level", "mechanic", "metValue", "instructions", "images",
      ];
      for (const key of allowed) {
        if (key in body) updateData[key] = body[key];
      }

      // If any images in JSON are base64 data URIs, upload them to Cloudinary
      if (Array.isArray(updateData.images)) {
        updateData.images = await Promise.all(
          updateData.images.map(async (img: string) => {
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

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    await getDb();
    const exercise = await ExerciseCatalog.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: "after", runValidators: true }
    );

    if (!exercise) {
      return NextResponse.json({ success: false, error: "Exercise not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, exercise });
  } catch (err: unknown) {
    console.error("Exercise update error:", err);
    const message = err instanceof Error ? err.message : "Failed to update exercise";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const result = await requireAdmin(request);
  if (result instanceof NextResponse) return result;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, error: "Invalid exercise ID" }, { status: 400 });
  }

  await getDb();
  const exercise = await ExerciseCatalog.findByIdAndDelete(id);
  if (!exercise) {
    return NextResponse.json({ success: false, error: "Exercise not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Exercise deleted" });
}
