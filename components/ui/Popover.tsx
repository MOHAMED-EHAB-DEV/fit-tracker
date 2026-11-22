"use client";

import React, { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePopover } from "@/hooks/usePopover";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { focusableElements, OVERLAY_ROOT_ATTRIBUTE } from "@/lib/ui/overlay-stack";
import { cn } from "@/lib/utils";

export type PopoverRole = "dialog" | "menu";

export interface PopoverProps {
  /** Content of the trigger button (Popover renders the <button> itself). */
  trigger: React.ReactNode;
  /** Accessible name of the trigger when its content is not text (an avatar, an icon). */
  triggerLabel?: string;
  /** Classes for the trigger button. */
  triggerClassName?: string;
  /** Panel content; a function receives `close`. */
  children: React.ReactNode | ((api: { close: () => void }) => React.ReactNode);
  /** Accessible name of the panel. */
  label: string;
  role?: PopoverRole;
  /** Horizontal alignment with the trigger. */
  align?: "start" | "end" | "center";
  side?: "bottom" | "top";
  offset?: number;
  /** Classes for the panel (width, padding). */
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

const ALIGN = { start: "left", end: "right", center: "center" } as const;

/**
 * The one popover: a small glass panel anchored to its trigger, for small
 * choices (set type, a date, the profile menu). Click outside, Escape and
 * Back close it (top layer first); focus returns to the trigger.
 *
 * With role="menu" the arrow keys move between items marked role="menuitem"
 * (see MenuItem).
 */
export function Popover({
  trigger,
  triggerLabel,
  triggerClassName,
  children,
  label,
  role = "dialog",
  align = "start",
  side = "bottom",
  offset = 6,
  className,
  onOpenChange,
}: PopoverProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openedByKeyboard = useRef(false);

  // The trigger is the popover's container: a click on it is not "outside".
  const {
    isOpen,
    setIsOpen,
    shouldRender,
    isAnimatingOut,
    containerRef: triggerRef,
  } = usePopover<HTMLButtonElement, HTMLDivElement>({
    floatingRef: panelRef,
    onOpenChange,
    closeOnEscape: true,
    closeOnClickOutside: true,
    durationMs: 120,
  });

  const { style } = useFloatingPosition({
    triggerRef,
    floatingRef: panelRef,
    isOpen: shouldRender,
    align: ALIGN[align],
    side,
    offset,
    autoFlip: true,
  });

  const close = useCallback(() => setIsOpen(false), [setIsOpen]);

  // Focus: into the panel on open (always for menus, for dialogs when opened
  // from the keyboard), back to the trigger on close.
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      if (role === "menu" || openedByKeyboard.current) {
        const target =
          panel.querySelector<HTMLElement>("[data-autofocus]") ||
          (role === "menu" ? panel.querySelector<HTMLElement>('[role="menuitem"]') : focusableElements(panel)[0]) ||
          panel;
        target.focus({ preventScroll: true });
      }
    });
    const triggerElement = triggerRef.current;
    return () => {
      cancelAnimationFrame(frame);
      const active = document.activeElement;
      // Return focus only when it was in the panel (not when the user clicked elsewhere).
      if (!active || active === document.body || document.getElementById(panelId)?.contains(active)) {
        triggerElement?.focus({ preventScroll: true });
      }
    };
  }, [isOpen, role, triggerRef, panelId]);

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      // Leaving a menu with Tab closes it (the focus moves on naturally).
      if (role === "menu") close();
      return;
    }
    if (role !== "menu") return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === "ArrowDown") next = index < items.length - 1 ? index + 1 : 0;
    else if (event.key === "ArrowUp") next = index > 0 ? index - 1 : items.length - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next >= 0) {
      event.preventDefault();
      items[next].focus();
    }
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const opens = event.key === "Enter" || event.key === " " || (event.key === "ArrowDown" && role === "menu");
    if (!opens) return;
    event.preventDefault();
    openedByKeyboard.current = true;
    setIsOpen(true);
  };

  const content = typeof children === "function" ? children({ close }) : children;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-haspopup={role}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => {
          openedByKeyboard.current = false;
          setIsOpen((open) => !open);
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn("cursor-pointer", triggerClassName)}
      >
        {trigger}
      </button>
      {shouldRender &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role={role}
            aria-label={label}
            tabIndex={-1}
            {...{ [OVERLAY_ROOT_ATTRIBUTE]: "" }}
            onKeyDown={onPanelKeyDown}
            style={style}
            className={cn(
              "glass-float min-w-48 rounded-card p-1.5 text-ink outline-none transition-[opacity,transform] duration-100",
              isAnimatingOut || !isOpen ? "pointer-events-none opacity-0" : "popover-in",
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

const MENU_ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-chip px-3 text-start text-sm font-medium text-ink outline-none transition-colors hover:bg-elevated focus-visible:bg-elevated cursor-pointer";

export interface MenuItemProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Renders a link (next/link). */
  href?: string;
  onSelect?: () => void;
  /** Danger text for destructive items (still never a red fill). */
  tone?: "ink" | "danger";
  disabled?: boolean;
}

/** An item inside <Popover role="menu">. */
export function MenuItem({ icon, children, href, onSelect, tone = "ink", disabled = false }: MenuItemProps) {
  const className = cn(MENU_ITEM, tone === "danger" && "text-danger", disabled && "pointer-events-none opacity-50");
  const inner = (
    <>
      {icon && (
        <span className={cn("flex shrink-0", tone === "danger" ? "text-danger" : "text-ink-2")} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
  return (
    <div role="none">
      {href ? (
        <Link href={href} role="menuitem" tabIndex={-1} onClick={onSelect} className={className}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          aria-disabled={disabled || undefined}
          disabled={disabled}
          onClick={onSelect}
          className={className}
        >
          {inner}
        </button>
      )}
    </div>
  );
}

/** A hairline between groups of menu items. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}

export default Popover;
