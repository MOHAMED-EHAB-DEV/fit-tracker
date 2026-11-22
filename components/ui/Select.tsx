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
          "w-full ps-3.5 pe-3 bg-elevated border rounded-control text-start flex items-center justify-between gap-2 transition-colors focus:outline-none cursor-pointer select-none",
          FIELD_SIZE[size],
          error
            ? "border-danger focus-visible:border-danger"
            : isOpen
            ? "border-accent"
            : "border-line hover:not-focus-visible:border-line-strong focus-visible:border-accent",
          disabled && FIELD_BOX_DISABLED,
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && <span aria-hidden="true" className="shrink-0">{selectedOption.icon}</span>}
          <span className={cn("truncate", selectedOption ? "text-ink" : "text-ink-3")}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-ink-3">
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
              className="p-1 hover:text-ink rounded-chip hover:bg-line transition cursor-pointer"
              aria-label="Clear selection"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              isOpen && "rotate-180 text-ink"
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
              "glass-float rounded-card p-1.5 transform transition duration-150 ease-out z-9999",
              actualSide === "top" ? "origin-bottom" : "origin-top",
              isAnimatingIn && !isAnimatingOut
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
            )}
          >
            {/* Search Box if enabled */}
            {searchable && (
              <div className="p-1.5 mb-1 border-b border-line">
                <div className="relative flex items-center">
                  <Search aria-hidden="true" className="w-3.5 h-3.5 text-ink-3 absolute left-3" />
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
                    className="w-full pl-9 pr-3 py-2 min-h-10 bg-elevated border border-line rounded-control text-ink text-base placeholder:text-ink-3 transition-colors focus:outline-none focus:border-accent"
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
                <li role="presentation" className="py-4 px-3 text-center text-xs text-ink-3">
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
                        "px-3.5 py-2.5 min-h-11 rounded-chip text-sm flex items-center justify-between cursor-pointer transition-colors duration-100 select-none",
                        isSelected
                          ? "bg-elevated text-ink font-semibold"
                          : isHighlighted
                          ? "bg-elevated text-ink"
                          : "text-ink-2 hover:bg-elevated/60",
                        opt.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.icon && <span aria-hidden="true" className="shrink-0">{opt.icon}</span>}
                        <div>
                          <span className="block truncate">{opt.label}</span>
                          {opt.description && (
                            <span className="text-xs text-ink-3 block truncate mt-0.5">
                              {opt.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check aria-hidden="true" className="w-4 h-4 text-ink shrink-0 ms-2" />
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
