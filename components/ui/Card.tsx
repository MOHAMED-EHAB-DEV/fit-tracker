"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "flat" | "interactive";
  isBlurred?: boolean;
}

export function Card({
  children,
  variant = "default",
  isBlurred = true,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] p-4 sm:p-6 text-zinc-100 transition-all duration-300 relative overflow-hidden",
        isBlurred ? "backdrop-blur-2xl" : "",
        variant === "default" &&
          "bg-zinc-900/80 border border-white/10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)] hover:border-white/20",
        variant === "bordered" &&
          "bg-zinc-950/60 border border-white/15 hover:border-emerald-500/50 shadow-sm",
        variant === "flat" &&
          "bg-zinc-900/40 border border-white/5",
        variant === "interactive" &&
          "bg-zinc-900/80 border border-white/10 hover:border-emerald-500/50 shadow-lg hover:shadow-emerald-500/10 cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-4 pb-4 border-b border-white/6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("py-4 flex-1", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("pt-4 border-t border-white/6 flex items-center justify-between gap-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
