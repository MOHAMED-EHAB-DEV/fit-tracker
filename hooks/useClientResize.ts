import { useState, useCallback } from "react";

interface ResizeOptions {
  maxDimension?: number;
  quality?: number;
}

export function useClientResize() {
  const [isResizing, setIsResizing] = useState(false);

  const resizeImage = useCallback(
    async (file: File, options?: ResizeOptions): Promise<Blob> => {
      setIsResizing(true);
      const maxDim = options?.maxDimension || 800;
      const quality = options?.quality || 0.82;

      try {
        let bitmap: ImageBitmap;
        if (typeof createImageBitmap === "function") {
          bitmap = await createImageBitmap(file);
        } else {
          // Fallback for older environments
          bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img as unknown as ImageBitmap);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
          });
        }

        const origWidth = bitmap.width;
        const origHeight = bitmap.height;

        let targetWidth = origWidth;
        let targetHeight = origHeight;

        // Scale down inside maxDim while preserving aspect ratio
        if (origWidth > maxDim || origHeight > maxDim) {
          if (origWidth >= origHeight) {
            targetWidth = maxDim;
            targetHeight = Math.round((origHeight / origWidth) * maxDim);
          } else {
            targetHeight = maxDim;
            targetWidth = Math.round((origWidth / origHeight) * maxDim);
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not acquire 2D canvas context");
        }

        // High quality downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

        return await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Canvas toBlob failed"));
              }
            },
            "image/webp",
            quality
          );
        });
      } finally {
        setIsResizing(false);
      }
    },
    []
  );

  return { resizeImage, isResizing };
}
