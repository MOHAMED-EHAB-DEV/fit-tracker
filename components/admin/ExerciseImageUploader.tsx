"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Link as LinkIcon,
  AlertCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FIELD_LABEL } from "@/components/ui/field-styles";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { readApi, errorMessage } from "@/components/admin/api";
import { EXERCISE_LIMITS } from "@/lib/admin/exercise-vocabulary";

/**
 * Exercise images. Each file is resized in the browser and uploaded on its
 * own request as soon as it is added, so a save only sends URLs. Previews go
 * through the same image proxy users see, so a preview that loads here also
 * loads for them.
 */

export interface ExerciseImageItem {
  id: string;
  /** Final URL once uploaded, or the stored/external URL. */
  url?: string;
  /** What the tile shows: a blob preview while uploading, then the URL. */
  previewUrl: string;
  status: "ready" | "uploading" | "error";
  error?: string;
  /** Uploaded in this editing session and not saved into the exercise yet. */
  unsaved?: boolean;
  /** Kept to retry a failed upload. */
  file?: File;
}

type SetImages = React.Dispatch<React.SetStateAction<ExerciseImageItem[]>>;

export interface ExerciseImageUploaderProps {
  images: ExerciseImageItem[];
  setImages: SetImages;
  className?: string;
}

const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_SIDE = 1600;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

let itemCounter = 0;
export const newImageId = (prefix: string) => `${prefix}-${++itemCounter}`;

export function revokePreview(item: ExerciseImageItem): void {
  if (item.previewUrl.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(item.previewUrl);
    } catch {
      // Already revoked.
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resizes a photo so the upload stays small. GIFs are kept as they are (resizing would drop animation). */
async function prepareForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("This GIF is larger than 3.5 MB. Compress it first.");
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This browser cannot read that image. Use a JPG, PNG or WebP file.");
  }
  try {
    for (const [side, quality] of [
      [MAX_SIDE, 0.85],
      [1200, 0.75],
      [900, 0.7],
    ] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot resize images.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let blob = await canvasToBlob(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        return new File([blob], `exercise.${ext}`, { type: blob.type });
      }
    }
    throw new Error("This image is still too large after resizing.");
  } finally {
    bitmap.close();
  }
}

async function uploadOne(file: File): Promise<string> {
  const prepared = await prepareForUpload(file);
  const body = new FormData();
  body.append("file", prepared);
  let response: Response;
  try {
    response = await fetch("/api/admin/exercises/images", { method: "POST", body });
  } catch {
    throw new Error("Could not reach the server. Check your connection and retry.");
  }
  const data = await readApi<{ url: string }>(response);
  return data.url;
}

/** Tells the server to drop an upload that will not be saved (best effort). */
export function discardUpload(url: string, keepalive: boolean = false): void {
  void fetch("/api/admin/exercises/images", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    keepalive,
  }).catch(() => undefined);
}

/** Same rules as the server's image proxy (the server re-checks and names the exact problem). */
function urlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Enter a full link that starts with https://";
  }
  if (url.protocol !== "https:") return "The link must start with https://";
  const host = url.hostname.toLowerCase();
  if (host === "res.cloudinary.com") {
    return /\/image\/upload\//.test(url.pathname) ? null : "Only public Cloudinary uploads (/image/upload/) can be used";
  }
  if (host !== "raw.githubusercontent.com") {
    return `Images from ${host} cannot be shown to users. Upload the file instead, or use raw.githubusercontent.com.`;
  }
  if (!/\.(jpe?g|png|gif|webp|avif)$/i.test(url.pathname)) return "The link must point directly to an image file";
  return null;
}

function Tile({
  item,
  index,
  total,
  onMove,
  onCover,
  onRemove,
  onRetry,
  onPreview,
}: {
  item: ExerciseImageItem;
  index: number;
  total: number;
  onMove: (index: number, delta: -1 | 1) => void;
  onCover: (index: number) => void;
  onRemove: (index: number) => void;
  onRetry: (item: ExerciseImageItem) => void;
  onPreview: (item: ExerciseImageItem) => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const loadFailed = failedSrc === item.previewUrl;
  const isCover = index === 0;
  const button =
    "min-h-11 min-w-11 flex items-center justify-center rounded-lg text-zinc-200 bg-zinc-900 border border-white/10 hover:bg-zinc-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400";

  return (
    <li
      className={cn(
        "rounded-2xl overflow-hidden bg-zinc-950 border flex flex-col",
        isCover ? "border-violet-500 ring-2 ring-violet-500/30" : "border-white/10"
      )}
    >
      <button
        type="button"
        onClick={() => onPreview(item)}
        disabled={item.status !== "ready" || loadFailed}
        className="relative aspect-4/3 w-full cursor-zoom-in disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
        aria-label={`View image ${index + 1}`}
      >
        {!loadFailed ? (
          <Image
            src={item.previewUrl}
            alt={`Exercise image ${index + 1}`}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            onError={() => setFailedSrc(item.previewUrl)}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center bg-zinc-900">
            <AlertCircle className="w-6 h-6 text-amber-400" aria-hidden="true" />
            <span className="text-xs text-zinc-300 font-semibold">Users cannot load this image</span>
          </span>
        )}
        <span className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {isCover && (
            <span className="px-2 py-0.5 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center gap-1">
              <Star className="w-3 h-3 fill-current text-amber-300" aria-hidden="true" /> Cover
            </span>
          )}
          {item.unsaved && item.status === "ready" && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-zinc-950 text-xs font-bold">Not saved yet</span>
          )}
        </span>
        {item.status === "uploading" && (
          <span className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 text-sm text-zinc-100 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Uploading…
          </span>
        )}
      </button>

      {item.status === "error" && (
        <p role="alert" className="px-2 pt-2 text-xs text-red-300">
          {item.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1 p-2">
        <button type="button" className={button} onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move image ${index + 1} earlier`}>
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <button type="button" className={button} onClick={() => onMove(index, 1)} disabled={index === total - 1} aria-label={`Move image ${index + 1} later`}>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
        {!isCover && (
          <button type="button" className={button} onClick={() => onCover(index)} aria-label={`Use image ${index + 1} as cover`} title="Use as cover">
            <Star className="w-4 h-4 text-amber-300" aria-hidden="true" />
          </button>
        )}
        {item.status === "error" && item.file && (
          <button type="button" className={button} onClick={() => onRetry(item)} aria-label={`Retry uploading image ${index + 1}`} title="Retry">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className={cn(button, "ml-auto text-red-300 hover:bg-red-500/20")}
          onClick={() => onRemove(index)}
          disabled={item.status === "uploading"}
          aria-label={`Remove image ${index + 1}`}
          title="Remove"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export function ExerciseImageUploader({ images, setImages, className }: ExerciseImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExerciseImageItem | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  const unmountedRef = useRef(false);
  const maxImages = EXERCISE_LIMITS.maxImages;

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Revoke any blob previews still alive when the editor closes.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      imagesRef.current.forEach(revokePreview);
    };
  }, []);

  const startUpload = async (id: string, file: File) => {
    setImages((current) => current.map((item) => (item.id === id ? { ...item, status: "uploading", error: undefined } : item)));
    try {
      const url = await uploadOne(file);
      const target = imagesRef.current.find((item) => item.id === id);
      if (!target || unmountedRef.current) {
        // The tile was removed (or the editor closed) while it was uploading.
        discardUpload(url);
        return;
      }
      revokePreview(target);
      setImages((current) =>
        current.map((item) => (item.id === id ? { id, url, previewUrl: url, status: "ready", unsaved: true } : item))
      );
    } catch (err) {
      setImages((current) =>
        current.map((item) => (item.id === id ? { ...item, status: "error", error: errorMessage(err) } : item))
      );
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);
    const accepted = files.filter((file) => ACCEPTED.includes(file.type));
    if (accepted.length < files.length) {
      setError("Only JPG, PNG, WebP and GIF images can be added. Other files were skipped.");
    }
    const room = maxImages - imagesRef.current.length;
    if (room <= 0) {
      setError(`An exercise can have at most ${maxImages} images.`);
      return;
    }
    if (accepted.length > room) setError(`Only ${room} more image${room === 1 ? "" : "s"} fit (maximum ${maxImages}).`);

    const items: ExerciseImageItem[] = accepted.slice(0, room).map((file) => ({
      id: newImageId("upload"),
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      file,
    }));
    if (items.length === 0) return;
    setImages((current) => [...current, ...items]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // One request per file, one at a time.
    for (const item of items) {
      await startUpload(item.id, item.file!);
    }
  };

  const removeAt = (index: number) => {
    const item = images[index];
    if (!item) return;
    revokePreview(item);
    if (item.unsaved && item.url) discardUpload(item.url);
    setImages((current) => current.filter((candidate) => candidate.id !== item.id));
  };

  const move = (index: number, delta: -1 | 1) => {
    setImages((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const makeCover = (index: number) => {
    setImages((current) => {
      if (index <= 0 || index >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      return [moved, ...next];
    });
  };

  const addUrl = () => {
    const trimmed = urlInputValue.trim();
    if (!trimmed) return;
    const problem = urlProblem(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    if (images.some((item) => item.url === trimmed)) {
      setError("This image is already added.");
      return;
    }
    if (images.length >= maxImages) {
      setError(`An exercise can have at most ${maxImages} images.`);
      return;
    }
    setImages((current) => [...current, { id: newImageId("url"), url: trimmed, previewUrl: trimmed, status: "ready" }]);
    setUrlInputValue("");
    setShowUrlInput(false);
    setError(null);
  };

  const full = images.length >= maxImages;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">
          Demonstration photos or diagrams ({images.length}/{maxImages}). The first image is the cover.
        </p>
        <button
          type="button"
          onClick={() => setShowUrlInput((value) => !value)}
          aria-expanded={showUrlInput}
          className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm font-semibold text-violet-300 hover:text-violet-200 transition cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
          <span>{showUrlInput ? "Hide link field" : "Add by link"}</span>
        </button>
      </div>

      {showUrlInput && (
        <div className="space-y-2 p-3 bg-zinc-950/80 border border-white/10 rounded-2xl">
          <label htmlFor="exercise-image-url" className={FIELD_LABEL}>
            Image link
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="exercise-image-url"
              type="url"
              inputMode="url"
              maxLength={EXERCISE_LIMITS.imageUrlMax}
              placeholder="https://raw.githubusercontent.com/…/image.jpg"
              value={urlInputValue}
              onChange={(e) => setUrlInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              containerClassName="flex-1"
            />
            <Button type="button" variant="solid" size="md" onClick={addUrl} disabled={full} className="min-h-11">
              Add link
            </Button>
          </div>
          <p className="text-xs text-zinc-400">
            Only links the app can show to users work: raw.githubusercontent.com image files and this app&apos;s Cloudinary uploads.
            For anything else, download the image and upload it.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:text-red-200 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!full) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!full && e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center gap-3 text-center transition",
          isDragging ? "border-violet-500 bg-violet-500/10" : "border-white/15 bg-zinc-950/50",
          full && "opacity-50"
        )}
      >
        <UploadCloud className="w-8 h-8 text-violet-300" aria-hidden="true" />
        <p className="text-sm text-zinc-200">
          {isDragging ? "Drop the images to upload them" : "Drag images here, or"}
        </p>
        <input
          ref={fileInputRef}
          id="exercise-image-files"
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
          }}
          className="sr-only"
          disabled={full}
        />
        <Button type="button" variant="bordered" size="md" disabled={full} onClick={() => fileInputRef.current?.click()} className="min-h-11">
          Choose images
        </Button>
        <p className="text-xs text-zinc-400">JPG, PNG, WebP or GIF. Photos are resized before upload; GIFs up to 3.5 MB.</p>
      </div>

      {images.length > 0 && (
        <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-3">
          {images.map((item, index) => (
            <Tile
              key={item.id}
              item={item}
              index={index}
              total={images.length}
              onMove={move}
              onCover={makeCover}
              onRemove={removeAt}
              onRetry={(failed) => failed.file && void startUpload(failed.id, failed.file)}
              onPreview={(selected) => {
                setPreviewFailed(false);
                setPreview(selected);
              }}
            />
          ))}
        </ul>
      )}

      <Modal
        isOpen={Boolean(preview)}
        onClose={() => setPreview(null)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-violet-400" aria-hidden="true" />
            <span className="font-bold text-white">Image preview (as users see it)</span>
          </span>
        }
      >
        {preview && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-white/10">
              {!previewFailed ? (
                <Image
                  src={preview.previewUrl}
                  alt="Exercise image preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  onError={() => setPreviewFailed(true)}
                  className="object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 gap-2 text-zinc-300">
                  <AlertCircle className="w-8 h-8 text-amber-400" aria-hidden="true" />
                  <p className="text-sm font-bold">Users cannot load this image either.</p>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-mono break-all">{preview.url || "Local file (uploading)"}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ExerciseImageUploader;
