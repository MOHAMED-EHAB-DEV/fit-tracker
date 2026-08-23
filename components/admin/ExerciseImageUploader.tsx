"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Eye,
  Star,
  ChevronLeft,
  ChevronRight,
  X,
  Link as LinkIcon,
  AlertCircle,
  FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export interface ExerciseImageItem {
  id: string;
  url?: string;
  file?: File;
  previewUrl: string;
}

export interface ExerciseImageUploaderProps {
  images: ExerciseImageItem[];
  onChange: (images: ExerciseImageItem[]) => void;
  className?: string;
  maxImages?: number;
}

export function ExerciseImageUploader({
  images = [],
  onChange,
  className,
  maxImages = 8,
}: ExerciseImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      images.forEach((item) => {
        if (item.file && item.previewUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(item.previewUrl);
          } catch {}
        }
      });
    };
  }, []);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files).filter((file) =>
        file.type.startsWith("image/")
      );

      if (fileArray.length === 0) {
        setError("Please select valid image files (JPG, PNG, WebP, GIF).");
        return;
      }

      // Max size limit: 10MB per image
      const oversized = fileArray.find((f) => f.size > 10 * 1024 * 1024);
      if (oversized) {
        setError(`File "${oversized.name}" exceeds the 10MB limit.`);
        return;
      }

      if (images.length + fileArray.length > maxImages) {
        setError(`Maximum ${maxImages} images allowed per exercise.`);
        return;
      }

      const newItems: ExerciseImageItem[] = fileArray.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      onChange([...images, ...newItems]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [images, maxImages, onChange]
  );

  // Drag & Drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const itemToRemove = images[indexToRemove];
    if (itemToRemove?.file && itemToRemove.previewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      } catch {}
    }
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    const selected = images[index];
    const remaining = images.filter((_, idx) => idx !== index);
    onChange([selected, ...remaining]);
  };

  const handleMove = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const updated = [...images];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onChange(updated);
  };

  const handleAddUrl = () => {
    const trimmed = urlInputValue.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setError("Please enter a valid URL starting with http:// or https://");
      return;
    }
    if (images.some((item) => item.url === trimmed || item.previewUrl === trimmed)) {
      setError("This image URL is already added.");
      return;
    }
    const newItem: ExerciseImageItem = {
      id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url: trimmed,
      previewUrl: trimmed,
    };
    onChange([...images, newItem]);
    setUrlInputValue("");
    setShowUrlInput(false);
    setError(null);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-zinc-400 font-medium">
            Upload demonstration photos or movement diagrams for this exercise ({images.length}/{maxImages})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition cursor-pointer"
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>{showUrlInput ? "Hide URL Input" : "Add by Image URL"}</span>
        </button>
      </div>

      {/* Optional URL Add Bar */}
      {showUrlInput && (
        <div className="flex items-center gap-2 p-3 bg-zinc-950/80 border border-white/10 rounded-2xl animate-in fade-in duration-200">
          <LinkIcon className="w-4 h-4 text-zinc-500 shrink-0 ml-1" />
          <input
            type="url"
            placeholder="Paste direct image link (https://...)"
            value={urlInputValue}
            onChange={(e) => setUrlInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />
          <Button
            type="button"
            variant="solid"
            size="sm"
            onClick={handleAddUrl}
            className="bg-violet-600 hover:bg-violet-500 text-white font-bold h-8 px-3 rounded-xl"
          >
            Add URL
          </Button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-3xl p-7 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-3.5 text-center select-none overflow-hidden",
          isDragging
            ? "border-violet-500 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.25)] scale-[1.01]"
            : "border-white/15 bg-zinc-950/50 hover:border-violet-500/50 hover:bg-zinc-950/80 shadow-inner",
          images.length >= maxImages && "pointer-events-none opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={images.length >= maxImages}
        />

        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md",
            isDragging
              ? "bg-violet-500 text-white scale-110 rotate-3"
              : "bg-zinc-900 border border-white/10 text-violet-400 hover:text-white hover:bg-violet-600"
          )}
        >
          <UploadCloud className="w-7 h-7" />
        </div>

        <div className="space-y-1 max-w-sm">
          <p className="text-sm font-bold text-zinc-100">
            {isDragging ? (
              <span className="text-violet-400">Drop your images right here!</span>
            ) : (
              <>
                <span className="text-violet-400 underline underline-offset-4 font-extrabold hover:text-violet-300">
                  Click to browse
                </span>{" "}
                or drag & drop exercise images
              </>
            )}
          </p>
          <p className="text-xs text-zinc-500">
            Supports PNG, JPG, WebP, GIF up to 10MB each (uploaded on save)
          </p>
        </div>
      </div>

      {/* Selected / Uploaded Images Gallery Grid */}
      {images.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
            <span>Selected Images ({images.length})</span>
            <span className="text-[11px] text-zinc-500">First image is used as primary cover</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {images.map((item, index) => {
              const isPrimary = index === 0;
              const isLocalFile = !!item.file;

              return (
                <div
                  key={item.id || item.previewUrl || index}
                  className={cn(
                    "group relative aspect-4/3 rounded-2xl overflow-hidden bg-zinc-950 border transition-all duration-200 shadow-md",
                    isPrimary
                      ? "border-violet-500 ring-2 ring-violet-500/30"
                      : "border-white/10 hover:border-white/20"
                  )}
                >
                  {/* Image Element */}
                  <Image
                    src={item.previewUrl}
                    alt={`Exercise media ${index + 1}`}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                    {isPrimary && (
                      <div className="px-2 py-0.5 rounded-lg bg-violet-600/90 backdrop-blur-md text-white text-[10px] font-extrabold flex items-center gap-1 shadow-md border border-violet-400/30">
                        <Star className="w-3 h-3 fill-current text-amber-300" />
                        <span>Primary Cover</span>
                      </div>
                    )}
                    {isLocalFile && (
                      <div className="px-2 py-0.5 rounded-lg bg-amber-500/80 backdrop-blur-md text-zinc-950 text-[9px] font-extrabold flex items-center gap-1 shadow-sm">
                        <FileImage className="w-2.5 h-2.5" />
                        <span>New (Pending Save)</span>
                      </div>
                    )}
                  </div>

                  {/* Hover Overlay with Action Buttons */}
                  <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5 z-20">
                    {/* Top Action Row */}
                    <div className="flex items-center justify-between gap-1">
                      {!isPrimary ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimary(index);
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-900/90 hover:bg-violet-600 text-zinc-300 hover:text-white text-[11px] font-bold transition flex items-center gap-1 border border-white/10 cursor-pointer shadow-xs"
                          title="Set as primary cover"
                        >
                          <Star className="w-3 h-3 text-amber-400" />
                          <span>Make Cover</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(index);
                        }}
                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition border border-red-500/30 cursor-pointer"
                        title="Remove image"
                        aria-label="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Action Row: Reorder & Preview */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMove(index, "left");
                          }}
                          className="p-1 rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 transition border border-white/10 cursor-pointer"
                          title="Move Left"
                          aria-label="Move image left"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === images.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMove(index, "right");
                          }}
                          className="p-1 rounded-lg bg-zinc-900/90 text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 transition border border-white/10 cursor-pointer"
                          title="Move Right"
                          aria-label="Move image right"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewUrl(item.previewUrl);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-white/10 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                        title="Full View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox / Full-size Preview Modal */}
      {previewUrl && (
        <Modal
          isOpen={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
          size="lg"
          title={
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-violet-400" />
              <span className="font-bold text-white">Exercise Image Preview</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-950 border border-white/10 flex items-center justify-center">
              <Image
                src={previewUrl}
                alt="Exercise preview full"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-contain rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="truncate max-w-md font-mono">{previewUrl}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewUrl(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ExerciseImageUploader;

