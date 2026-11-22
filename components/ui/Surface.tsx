import React from "react";
import { cn } from "@/lib/utils";

type SurfaceElement = "div" | "section" | "article" | "aside" | "li";

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: SurfaceElement;
  /** 16px inside padding. Off for lists and ledgers that run edge to edge. */
  padded?: boolean;
  /** "canvas" sits a step below a surface (a card inside a card, a vignette). */
  tone?: "surface" | "canvas";
}

/**
 * The matte card: one tonal step above the page plus a hairline. No shadow,
 * no blur, no gradient.
 */
export function Surface({ as: Element = "div", padded = true, tone = "surface", className, ...props }: SurfaceProps) {
  return (
    <Element
      className={cn(
        "rounded-card border border-line",
        tone === "surface" ? "bg-surface" : "bg-canvas",
        padded && "p-4",
        className
      )}
      {...props}
    />
  );
}

export default Surface;
