"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/ui/Calendar";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { cn } from "@/lib/utils";

export interface HabitsCalendarPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  selectedDateStr: string;
  todayStr: string;
  onSelectDate: (dateStr: string) => void;
  logsMap?: Record<string, string[]>;
}

export function HabitsCalendarPopover({
  isOpen,
  onClose,
  triggerRef,
  selectedDateStr,
  todayStr,
  onSelectDate,
  logsMap = {},
}: HabitsCalendarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { style: floatingStyle, actualSide } = useFloatingPosition({
    triggerRef,
    floatingRef: popoverRef,
    isOpen,
    align: "left",
    side: "bottom",
    offset: 8,
    autoFlip: true,
  });

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

  if (!isOpen || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Habits Calendar"
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
        maxDate={todayStr}
        weekStartsOn={6}
        indicatorDates={logsMap}
        indicatorLabel="Days with habits"
        onClose={onClose}
      />
    </div>,
    document.body
  );
}

export default HabitsCalendarPopover;
