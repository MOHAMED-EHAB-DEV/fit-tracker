"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveRulerProps {
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  unitOptions?: { label: string; value: string }[];
  activeUnit?: string;
  onUnitChange?: (unit: string) => void;
  majorInterval?: number;
  secondaryDisplay?: string;
  ariaLabel?: string;
}

export function InteractiveRuler({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  unitOptions,
  activeUnit,
  onUnitChange,
  majorInterval = 10,
  secondaryDisplay,
  ariaLabel = "Adjust measurement",
}: InteractiveRulerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startVal, setStartVal] = useState(value);
  const [isEditingDirectly, setIsEditingDirectly] = useState(false);
  const [directInput, setDirectInput] = useState(String(value));

  useEffect(() => {
    setDirectInput(String(value));
  }, [value]);

  const clampAndRound = useCallback(
    (val: number) => {
      const clamped = Math.max(min, Math.min(max, val));
      if (step < 1) {
        return parseFloat(clamped.toFixed(1));
      }
      return Math.round(clamped);
    },
    [min, max, step]
  );

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setStartVal(value);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setStartVal(value);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      // Sensitivity: ~8px per step unit
      const unitDelta = -(deltaX / 8) * step;
      onChange(clampAndRound(startVal + unitDelta));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const deltaX = e.touches[0].clientX - startX;
      const unitDelta = -(deltaX / 8) * step;
      onChange(clampAndRound(startVal + unitDelta));
    };

    const handleEnd = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      window.addEventListener("touchend", handleEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, startX, startVal, step, clampAndRound, onChange]);

  // Adjust by delta
  const adjustBy = (delta: number) => {
    onChange(clampAndRound(value + delta));
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      adjustBy(-step);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      adjustBy(step);
    } else if (e.key === "PageDown") {
      e.preventDefault();
      adjustBy(-majorInterval);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      adjustBy(majorInterval);
    }
  };

  const handleDirectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(directInput);
    if (!isNaN(parsed)) {
      onChange(clampAndRound(parsed));
    }
    setIsEditingDirectly(false);
  };

  // Generate tick markers centered around the current value
  const tickRange = 15;
  const ticks = [];
  const currentInt = Math.round(value);

  for (let i = currentInt - tickRange; i <= currentInt + tickRange; i++) {
    if (i >= min && i <= max) {
      const isMajor = i % majorInterval === 0;
      const isSemiMajor = !isMajor && (majorInterval === 10 ? i % 5 === 0 : false);
      const isMinor = !isMajor && !isSemiMajor;

      const diff = i - value;
      const pixelOffset = diff * 14;

      ticks.push({
        val: i,
        isMajor,
        isSemiMajor,
        isMinor,
        pixelOffset,
      });
    }
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} ${unit}`}
      onKeyDown={handleKeyDown}
      className="flex flex-col items-center select-none space-y-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-2xl p-2"
    >
      {/* Unit Selector Toggle */}
      {unitOptions && unitOptions.length > 1 && onUnitChange && activeUnit && (
        <div
          role="radiogroup"
          aria-label="Measurement Unit"
          className="flex items-center p-1 bg-zinc-950 rounded-2xl border border-zinc-800"
        >
          {unitOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={activeUnit === opt.value}
              tabIndex={activeUnit === opt.value ? 0 : -1}
              onClick={() => onUnitChange(opt.value)}
              className={cn(
                "px-4 py-1.5 min-h-[36px] rounded-xl text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                activeUnit === opt.value
                  ? "bg-zinc-800 text-emerald-400 shadow-sm ring-1 ring-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Big Digital Readout (Clickable for direct edit) */}
      <div className="flex flex-col items-center justify-center">
        {isEditingDirectly ? (
          <form onSubmit={handleDirectSubmit} className="flex items-center gap-2">
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              autoFocus
              aria-label={`Enter exact value in ${unit}`}
              value={directInput}
              onChange={(e) => setDirectInput(e.target.value)}
              onBlur={handleDirectSubmit}
              className="w-28 text-center text-4xl sm:text-5xl font-black bg-zinc-950 text-emerald-400 border border-emerald-500 rounded-2xl py-1 tabular-nums focus:outline-none ring-2 ring-emerald-500/50"
            />
            <span className="text-xl sm:text-2xl font-bold text-zinc-400">{unit}</span>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingDirectly(true)}
            title="Click to type manually"
            aria-label={`Current value ${value} ${unit}. Click to type manually.`}
            className="group flex items-baseline gap-2 py-1 px-4 rounded-2xl hover:bg-zinc-800/60 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span className="text-5xl sm:text-6xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors tabular-nums">
              {value}
            </span>
            <span className="text-2xl font-bold text-emerald-400/90">{unit}</span>
          </button>
        )}

        {secondaryDisplay && (
          <span className="text-xs font-semibold text-zinc-500 mt-1 tabular-nums">
            {secondaryDisplay}
          </span>
        )}
      </div>

      {/* Interactive Ruler Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={cn(
          "w-full h-24 bg-zinc-950/80 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center cursor-grab",
          isDragging && "cursor-grabbing"
        )}
      >
        {/* Soft edge gradient fades */}
        <div className="absolute inset-y-0 left-0 w-16 bg-linear-to-r from-zinc-950 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-16 bg-linear-to-l from-zinc-950 to-transparent pointer-events-none z-10" />

        {/* Center Target Indicator Needle (Emerald Glow) */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-emerald-400 z-20 shadow-[0_0_12px_#34d399] flex flex-col items-center justify-between pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 -mt-1 shadow-sm" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 -mb-1 shadow-sm" />
        </div>

        {/* Tick Tape Strip */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {ticks.map((t) => (
            <div
              key={t.val}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-between py-3"
              style={{
                transform: `translateX(${t.pixelOffset}px)`,
              }}
            >
              {/* Top tick */}
              <div
                className={cn(
                  "w-0.5 rounded-full",
                  t.isMajor
                    ? "h-6 bg-zinc-300"
                    : t.isSemiMajor
                    ? "h-4 bg-zinc-500"
                    : "h-2.5 bg-zinc-700"
                )}
              />

              {/* Number label on major ticks */}
              {t.isMajor && (
                <span className="text-[10px] font-bold text-zinc-400 select-none tabular-nums">
                  {t.val}
                </span>
              )}

              {/* Bottom tick */}
              <div
                className={cn(
                  "w-0.5 rounded-full",
                  t.isMajor
                    ? "h-6 bg-zinc-300"
                    : t.isSemiMajor
                    ? "h-4 bg-zinc-500"
                    : "h-2.5 bg-zinc-700"
                )}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Fine-Tuning Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease by ${majorInterval}`}
          onClick={() => adjustBy(-majorInterval)}
          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
        >
          <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={`Decrease by ${step}`}
          onClick={() => adjustBy(-step)}
          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <span className="text-[11px] font-semibold text-zinc-500 px-2 text-center select-none">
          Drag ruler or use keys
        </span>

        <button
          type="button"
          aria-label={`Increase by ${step}`}
          onClick={() => adjustBy(step)}
          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={`Increase by ${majorInterval}`}
          onClick={() => adjustBy(majorInterval)}
          className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
        >
          <ChevronsRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default InteractiveRuler;
