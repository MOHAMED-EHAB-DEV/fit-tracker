import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: React.ReactNode;
  /** Quiet text on the right ("2 of 4 left", "3 logged"). */
  meta?: React.ReactNode;
  /** A link on the right instead of meta text. */
  action?: { label: string; href: string };
  /** Heading level for the outline of the page. */
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}

/** The small label above a list or card ("Meals today · 3 logged"). */
export function SectionHeader({ title, meta, action, as: Heading = "h2", id, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex min-h-6 items-center justify-between gap-3 px-0.5", className)}>
      <Heading id={id} className="text-[13px] font-semibold leading-5 text-ink-2">
        {title}
      </Heading>
      {action ? (
        <Link
          href={action.href}
          className="-my-2 inline-flex min-h-11 items-center text-xs font-medium text-ink-3 transition-colors hover:text-ink"
        >
          {action.label}
        </Link>
      ) : (
        meta && <span className="text-xs font-medium text-ink-3">{meta}</span>
      )}
    </div>
  );
}

export default SectionHeader;
