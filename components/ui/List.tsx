import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hairline-divided rows inside one card: typography instead of nested cards.
 *
 *   <List>
 *     <ListRow title="Upper body A" subtitle="6 exercises" trailing={<Button size="sm">Start</Button>} />
 *   </List>
 */
export function List({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn("overflow-hidden rounded-card border border-line bg-surface divide-y divide-line", className)}
      {...props}
    >
      {children}
    </ul>
  );
}

export interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Before the text: an icon, avatar or tick. */
  leading?: React.ReactNode;
  /** After the text: a value, a button, a menu. */
  trailing?: React.ReactNode;
  /** A user-chosen colour (habit, planner category), shown only as a 3px bar. */
  barColor?: string;
  /** The whole row navigates. Shows a chevron unless `trailing` is given. */
  href?: string;
  /** The whole row is a button. */
  onClick?: () => void;
  /** Quieter title (done items). */
  muted?: boolean;
  className?: string;
  /** Accessible name when the row is a link or button and the title is not plain text. */
  ariaLabel?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  barColor,
  href,
  onClick,
  muted = false,
  className,
  ariaLabel,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {barColor && (
          <span aria-hidden="true" className="h-7 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: barColor }} />
        )}
        {leading && <span className="flex shrink-0 items-center">{leading}</span>}
        <span className="min-w-0">
          <span className={cn("block truncate text-sm font-medium", muted ? "text-ink-2" : "text-ink")}>{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-xs text-ink-3">{subtitle}</span>}
        </span>
      </span>
      {trailing ? (
        <span className="flex shrink-0 items-center gap-2">{trailing}</span>
      ) : (
        interactive && <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
      )}
    </>
  );

  const rowClass = cn(
    "flex min-h-12 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start",
    interactive && "cursor-pointer transition-colors hover:bg-elevated/60 active:bg-elevated",
    className
  );

  if (href) {
    return (
      <li>
        <Link href={href} className={rowClass} aria-label={ariaLabel}>
          {content}
        </Link>
      </li>
    );
  }
  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className={rowClass} aria-label={ariaLabel}>
          {content}
        </button>
      </li>
    );
  }
  return <li className={rowClass}>{content}</li>;
}

export default List;
