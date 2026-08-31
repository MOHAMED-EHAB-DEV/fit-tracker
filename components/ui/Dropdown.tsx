"use client";

import React, { useRef, useId, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePopover } from "@/hooks/usePopover";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { cn } from "@/lib/utils";

export interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  ariaLabel?: string;
  className?: string;
  menuClassName?: string;
}

export function Dropdown({
  trigger,
  children,
  align = "right",
  ariaLabel = "Menu options",
  className,
  menuClassName,
}: DropdownProps) {
  const dropdownId = useId();
  const menuRef = useRef<HTMLUListElement>(null);

  const {
    isOpen,
    setIsOpen,
    containerRef,
    shouldRender,
    isAnimatingIn,
    isAnimatingOut,
  } = usePopover<HTMLDivElement, HTMLUListElement>({
    durationMs: 150,
    closeOnEscape: true,
    closeOnClickOutside: true,
    floatingRef: menuRef,
  });

  const { style: floatingStyle, actualSide } = useFloatingPosition({
    triggerRef: containerRef,
    floatingRef: menuRef,
    isOpen: shouldRender,
    align,
    side: "bottom",
    offset: 6,
    autoFlip: true,
  });

  // Focus first menuitem on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
        firstItem?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard accessibility: navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
    if (!items || items.length === 0) return;

    const currentIndex = Array.from(items).indexOf(document.activeElement as HTMLElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={cn("relative inline-block text-start", className)}
    >
      {/* Trigger */}
      <button
        type="button"
        id={`${dropdownId}-trigger`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${dropdownId}-menu` : undefined}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer inline-flex items-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition active:scale-95"
      >
        {trigger}
      </button>

      {/* Portaled Floating Menu */}
      {shouldRender && typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={menuRef}
            id={`${dropdownId}-menu`}
            role="menu"
            aria-labelledby={`${dropdownId}-trigger`}
            aria-orientation="vertical"
            style={floatingStyle}
            className={cn(
              "min-w-52 rounded-[22px] bg-zinc-900/95 border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.8),0_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl p-1.5 focus:outline-none transform list-none ring-1 ring-white/5 transition duration-150 ease-out",
              actualSide === "top" ? "origin-bottom" : "origin-top",
              isAnimatingIn && !isAnimatingOut
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
              menuClassName
            )}
          >
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child as React.ReactElement<any>, {
                  onSelect: () => {
                    (child.props as any).onClick?.();
                    setIsOpen(false);
                  },
                });
              }
              return child;
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  onSelect,
  icon,
  destructive = false,
  disabled = false,
  ariaLabel,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  onSelect?: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    onSelect?.();
  };

  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl text-start transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 active:scale-[0.98] cursor-pointer",
          destructive
            ? "text-red-400 hover:bg-red-500/15 hover:text-red-300 focus:bg-red-500/15"
            : "text-zinc-200 hover:bg-white/10 hover:text-white focus:bg-white/10",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {icon && <span aria-hidden="true" className="w-4 h-4 shrink-0">{icon}</span>}
        <span className="flex-1 truncate">{children}</span>
      </button>
    </li>
  );
}

export function DropdownLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li role="presentation" aria-hidden="true" className={cn("px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500", className)}>
      {children}
    </li>
  );
}

export function DropdownSeparator({ className }: { className?: string }) {
  return <li role="separator" className={cn("my-1.5 h-px bg-white/6 list-none", className)} />;
}

export default Dropdown;
