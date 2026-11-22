"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, Minus, Plus } from "lucide-react";

export interface KeypadBarProps {
  /** "kg", "reps", "sec"… for the stepper labels. */
  unitLabel: string;
  step: number;
  onStep: (delta: number) => void;
  /** "Next" moves weight → reps; on the last box it logs the set. */
  nextLabel: string;
  onNext: () => void;
}

/** Distance between the bottom of the layout viewport and the top of the on-screen keyboard. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - (viewport.offsetTop + viewport.height))));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/** Keeps focus in the box being edited when a bar button is pressed. */
const keepFocus = (event: React.PointerEvent | React.MouseEvent) => event.preventDefault();

/**
 * The accessory bar above the keyboard while a set value is edited: steppers
 * (±2.5 kg, ±1 rep…) and Next (weight → reps → log the set). It follows the
 * visible area, so it sits on the keyboard on iPhones and Android alike.
 */
export function KeypadBar({ unitLabel, step, onStep, nextLabel, onNext }: KeypadBarProps) {
  const inset = useKeyboardInset();
  const stepText = Number.isInteger(step) ? String(step) : step.toFixed(1);
  const button =
    "inline-flex h-11 items-center justify-center gap-1 rounded-control border border-line bg-elevated px-3 font-mono text-[13px] font-medium text-ink transition-colors hover:border-line-strong active:scale-[0.97] cursor-pointer";

  return (
    <div
      role="toolbar"
      aria-label="Number keypad tools"
      className="glass-chrome fixed inset-x-0 z-[45] md:start-(--rail-width)"
      style={{ bottom: inset }}
    >
      <div className="mx-auto flex h-14 max-w-[680px] items-center gap-2 px-3">
        <button type="button" className={button} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={() => onStep(-step)} aria-label={`Minus ${stepText} ${unitLabel}`}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          {stepText}
        </button>
        <button type="button" className={button} onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={() => onStep(step)} aria-label={`Plus ${stepText} ${unitLabel}`}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {stepText}
        </button>
        <span className="flex-1 truncate text-xs text-ink-3">{unitLabel}</span>
        <button
          type="button"
          onPointerDown={keepFocus}
          onMouseDown={keepFocus}
          onClick={onNext}
          className="inline-flex h-11 items-center gap-1 rounded-control bg-ink px-4 text-sm font-semibold text-ink-inverse transition-opacity hover:opacity-90 cursor-pointer"
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default KeypadBar;
