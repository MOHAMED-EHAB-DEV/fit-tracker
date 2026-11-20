"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { usePopover } from "@/hooks/usePopover";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { cn } from "@/lib/utils";
import {
  FIELD_BOX_DISABLED,
  FIELD_ERROR,
  FIELD_LABEL,
  FIELD_SIZE,
  type FieldSize,
} from "@/components/ui/field-styles";

export interface SelectOption<T = string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T = string | number> {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  error?: string;
  ariaLabel?: string;
  /** Classes for the outer wrapper (label + trigger + error). */
  className?: string;
  /** Classes for the trigger button. */
  triggerClassName?: string;
  size?: FieldSize;
  id?: string;
  /** Submits the value under this name inside a <form>. */
  name?: string;
}

export function Select<T = string | number>({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  label,
  searchable = false,
  clearable = false,
  disabled = false,
  error,
  ariaLabel,
  className,
  triggerClassName,
  size = "md",
  id,
  name,
}: SelectProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const generatedId = useId();
  const selectId = id || generatedId;

  const {
    isOpen,
    setIsOpen,
    containerRef,
    shouldRender,
    isAnimatingIn,
    isAnimatingOut,
  } = usePopover<HTMLDivElement, HTMLDivElement>({
    durationMs: 150,
    closeOnEscape: true,
    closeOnClickOutside: true,
    floatingRef: listboxWrapperRef,
  });

  const { style: floatingStyle, actualSide } = useFloatingPosition({
    triggerRef,
    floatingRef: listboxWrapperRef,
    isOpen: shouldRender,
    matchWidth: true,
    side: "bottom",
    offset: 6,
    autoFlip: true,
  });

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Opening highlights the current choice; closing clears the search (derived during render).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setSearchQuery("");
    }
  }

  useEffect(() => {
    if (!isOpen || !searchable) return;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [isOpen, searchable]);

  const handleSelect = (opt: SelectOption<T>) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    // Keyboard users continue from the field they just filled.
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onChange(null as unknown as T);
  };

  // Keyboard navigation (on the trigger, and on the search box while it has focus)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    // In the search box a space is part of the search text, not a choice.
    const typingInSearch = e.target === searchInputRef.current;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlightedIndex(filteredOptions.length - 1);
    } else if (e.key === "Enter" || (e.key === " " && !typingInSearch)) {
      e.preventDefault();
      const opt = filteredOptions[highlightedIndex];
      if (opt && !opt.disabled) {
        handleSelect(opt);
      }
    } else if (e.key === "Escape") {
      // Only this list closes, not a dialog around it.
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full space-y-1.5 text-start", className)}>
      {label && (
        <label id={`${selectId}-label`} htmlFor={id || `${selectId}-button`} className={FIELD_LABEL}>
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={id || `${selectId}-button`}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${selectId}-listbox` : undefined}
        aria-labelledby={label ? `${selectId}-label` : undefined}
        aria-label={ariaLabel || (!label ? placeholder : undefined)}
        aria-activedescendant={isOpen && highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full ps-3.5 pe-3 bg-surface-2 border rounded-xl text-start flex items-center justify-between gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 cursor-pointer select-none",
          FIELD_SIZE[size],
          error
            ? "border-red-500/80 focus-visible:border-red-500"
            : isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/25"
            : "border-line hover:border-white/20 focus-visible:border-emerald-500",
          disabled && FIELD_BOX_DISABLED,
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && <span aria-hidden="true" className="shrink-0">{selectedOption.icon}</span>}
          <span className={cn("truncate", selectedOption ? "text-white" : "text-zinc-500")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
          {clearable && selectedOption && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear(e);
                }
              }}
              className="p-1 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              isOpen && "rotate-180 text-emerald-400"
            )}
          />
        </div>
      </button>

      {error && (
        <p role="alert" className={FIELD_ERROR}>
          {error}
        </p>
      )}

      {name && <input type="hidden" name={name} value={value === null || value === undefined ? "" : String(value)} />}

      {/* Portaled Popover Listbox */}
      {shouldRender && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listboxWrapperRef}
            style={floatingStyle}
            className={cn(
              "rounded-[22px] bg-zinc-900/95 border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.8),0_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl p-1.5 transform ring-1 ring-white/5 transition duration-150 ease-out z-9999",
              actualSide === "top" ? "origin-bottom" : "origin-top",
              isAnimatingIn && !isAnimatingOut
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            )}
          >
            {/* Search Box if enabled */}
            {searchable && (
              <div className="p-1.5 mb-1 border-b border-white/6">
                <div className="relative flex items-center">
                  <Search aria-hidden="true" className="w-3.5 h-3.5 text-zinc-500 absolute left-3" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="searchbox"
                    aria-label="Filter options"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    aria-controls={`${selectId}-listbox`}
                    aria-activedescendant={highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined}
                    placeholder="Search..."
                    className="w-full pl-9 pr-3 py-2 min-h-10 bg-zinc-950/90 border border-white/10 rounded-xl text-white text-base placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Semantic Options List */}
            <ul
              ref={listRef}
              id={`${selectId}-listbox`}
              role="listbox"
              aria-labelledby={label ? `${selectId}-label` : `${selectId}-button`}
              tabIndex={-1}
              className="max-h-60 overflow-y-auto space-y-1 p-0.5"
            >
              {filteredOptions.length === 0 ? (
                <li role="presentation" className="py-4 px-3 text-center text-xs text-zinc-500">
                  No matching options found
                </li>
              ) : (
                filteredOptions.map((opt, i) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = i === highlightedIndex;

                  return (
                    <li
                      key={String(opt.value)}
                      id={`${selectId}-opt-${i}`}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={cn(
                        "px-3.5 py-2.5 min-h-11 rounded-xl text-sm flex items-center justify-between cursor-pointer transition-colors duration-100 select-none",
                        isSelected
                          ? "bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/20 shadow-sm"
                          : isHighlighted
                          ? "bg-white/10 text-white font-semibold"
                          : "text-zinc-300 hover:bg-white/5",
                        opt.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.icon && <span aria-hidden="true" className="shrink-0">{opt.icon}</span>}
                        <div>
                          <span className="block truncate">{opt.label}</span>
                          {opt.description && (
                            <span className="text-xs text-zinc-400 block truncate mt-0.5">
                              {opt.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

export default Select;
