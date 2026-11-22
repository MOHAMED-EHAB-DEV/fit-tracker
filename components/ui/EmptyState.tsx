import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** A lucide icon element. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The next step: usually one primary button, optionally a secondary one. */
  actions?: React.ReactNode;
  /** Inside a card (bordered) or bare inside an existing container. */
  framed?: boolean;
  className?: string;
}

/** What a screen shows before there is anything in it, with the next step. */
export function EmptyState({ icon, title, description, actions, framed = true, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-5 py-8 text-center",
        framed && "rounded-card border border-line bg-surface",
        className
      )}
    >
      {icon && (
        <span
          className="grid h-10 w-10 place-items-center rounded-control border border-line bg-elevated text-ink-2"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-section font-semibold text-ink">{title}</p>
        {description && <p className="text-sm leading-5 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

export default EmptyState;
