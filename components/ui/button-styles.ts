import { cn } from "@/lib/utils";

/**
 * Button looks, shared by <Button> and by links or static previews that must
 * look like buttons (no "use client", so server components can use it too).
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  // Ink on the page, inverse text. One per viewport.
  primary: "bg-ink text-ink-inverse font-semibold hover:opacity-90",
  secondary: "bg-elevated text-ink border border-line font-medium hover:border-line-strong",
  ghost: "bg-transparent text-ink-2 font-medium hover:bg-elevated hover:text-ink",
  // Destructive actions are marked by the danger text colour, never a red fill.
  danger: "bg-elevated text-danger border border-line font-semibold hover:border-line-strong",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-[13px] gap-1.5 rounded-chip",
  md: "min-h-11 px-4 text-sm gap-2 rounded-control",
  lg: "min-h-12 px-4 text-sm gap-2 rounded-control",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex items-center justify-center leading-tight select-none cursor-pointer transition-[opacity,background-color,border-color,color] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    fullWidth && "w-full",
    className
  );
}
