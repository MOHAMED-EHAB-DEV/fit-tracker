"use client";

import React, { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/ui/Calendar";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { cn } from "@/lib/utils";
import { useUser } from "@/context/UserContext";

const CALENDAR_WEEK_START: Record<string, 0 | 1 | 6> = { saturday: 6, sunday: 0, monday: 1 };

export interface NutritionCalendarPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  selectedDateStr: string;
  minDate?: string;
  maxDate?: string;
  onSelectDate: (dateStr: string) => void;
  availableDates?: string[];
}

export function NutritionCalendarPopover({
  isOpen,
  onClose,
  triggerRef,
  selectedDateStr,
  minDate,
  maxDate,
  onSelectDate,
  availableDates = [],
}: NutritionCalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { weekStartDay } = useUser();
  const weekStartsOn = CALENDAR_WEEK_START[weekStartDay] ?? 6;

  const { style: floatingStyle, actualSide } = useFloatingPosition({
    triggerRef,
    floatingRef: popoverRef,
    isOpen,
    align: "right",
    side: "bottom",
    offset: 8,
    autoFlip: true,
  });

  // Move focus into the popover when it opens and back to the trigger when it closes.
  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const frame = requestAnimationFrame(() => {
      const target =
        popoverRef.current?.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"]') ||
        popoverRef.current?.querySelector<HTMLElement>("button:not([disabled])");
      (target || popoverRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      trigger?.focus();
    };
  }, [isOpen, triggerRef]);

  // Handle click outside and Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  // Opened only by a user action, so it never renders during server rendering.
  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label="Pick a day"
      tabIndex={-1}
      style={floatingStyle}
      className={cn(
        "focus:outline-none select-none transition duration-150 ease-out animate-in fade-in zoom-in-95",
        actualSide === "top" ? "origin-bottom" : "origin-top"
      )}
    >
      <Calendar
        value={selectedDateStr}
        onChange={(dateStr) => {
          onSelectDate(dateStr);
          onClose();
        }}
        minDate={minDate}
        maxDate={maxDate}
        today={maxDate}
        weekStartsOn={weekStartsOn}
        indicatorDates={availableDates}
        indicatorLabel="Days with meals"
        showTodayShortcut={false}
        onClose={onClose}
      />
    </div>,
    document.body
  );
}

export default NutritionCalendarPopover;
