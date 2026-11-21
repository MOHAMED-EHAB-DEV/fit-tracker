"use client";

import React, { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";
import { Archive, Loader2, Palette } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FIELD_LABEL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";
import { usePopover } from "@/hooks/usePopover";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { OVERLAY_ROOT_ATTRIBUTE } from "@/lib/ui/overlay-stack";
import type { HabitDTO } from "@/lib/habits/dto";
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_EMOJI,
  HABIT_COLOR_PRESETS,
  normalizeHexColor,
  safeHabitColor,
} from "@/lib/habits/colors";
import { HABIT_DESCRIPTION_MAX, HABIT_NAME_MAX } from "@/lib/validation/habits";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { errorMessage, requestJson, type HabitResponse } from "./api";

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex h-full items-center justify-center p-8 text-zinc-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" aria-hidden="true" />
      <span className="text-xs">Loading emoji picker...</span>
    </div>
  ),
});

interface HabitFormModalProps {
  isOpen: boolean;
  /** The habit being edited; null/undefined creates a new habit. */
  habit?: HabitDTO | null;
  onClose: () => void;
  onSaved: (habit: HabitDTO) => void;
  /** Edit mode only: asks the parent to archive (it shows the confirmation). */
  onRequestArchive?: (habit: HabitDTO) => void;
}

/** Add / edit habit dialog. Remounts per habit (keyed by the caller). */
export function HabitFormModal(props: HabitFormModalProps) {
  // Re-initialise the form whenever a different habit (or "new") is opened.
  const key = props.isOpen ? props.habit?._id || "new" : "closed";
  return <HabitFormModalInner key={key} {...props} />;
}

function HabitFormModalInner({ isOpen, habit, onClose, onSaved, onRequestArchive }: HabitFormModalProps) {
  const isEdit = Boolean(habit);
  const ids = {
    name: useId(),
    description: useId(),
    descriptionCount: useId(),
    color: useId(),
    colorText: useId(),
    error: useId(),
  };
  const [name, setName] = useState(habit?.name || "");
  const [description, setDescription] = useState(habit?.description || "");
  const [emoji, setEmoji] = useState(habit?.emoji || DEFAULT_HABIT_EMOJI);
  const [colorText, setColorText] = useState(habit ? safeHabitColor(habit.color) : DEFAULT_HABIT_COLOR);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const {
    isOpen: emojiOpen,
    toggle: toggleEmoji,
    close: closeEmoji,
    containerRef: emojiButtonRef,
    shouldRender: emojiRendered,
    isAnimatingIn: emojiEntering,
    isAnimatingOut: emojiLeaving,
  } = usePopover<HTMLButtonElement, HTMLDivElement>({ floatingRef: emojiPanelRef });
  const {
    style: emojiStyle,
    actualSide: emojiSide,
    isReady: emojiPlaced,
  } = useFloatingPosition({
    triggerRef: emojiButtonRef,
    floatingRef: emojiPanelRef,
    isOpen: emojiRendered,
    side: "bottom",
    align: "left",
    offset: 8,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const color = normalizeHexColor(colorText);
  const previewColor = color ?? DEFAULT_HABIT_COLOR;
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  /** Show the counter once 80% of the limit is used. */
  const showDescriptionCount = description.length >= HABIT_DESCRIPTION_MAX * 0.8;
  const canSave = !saving && trimmedName.length > 0 && Boolean(color);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!trimmedName) {
      setError("Please enter a habit name.");
      return;
    }
    if (!color) {
      setError("Colour must be a hex value such as #10b981.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = JSON.stringify({
        name: trimmedName,
        description: trimmedDescription,
        emoji: emoji || DEFAULT_HABIT_EMOJI,
        color,
      });
      const result = await requestJson<HabitResponse>(isEdit ? `/api/habits/${habit!._id}` : "/api/habits", {
        method: isEdit ? "PATCH" : "POST",
        body: payload,
      });
      markDashboardStale();
      onSaved(result.habit);
      onClose();
    } catch (err) {
      setError(errorMessage(err, isEdit ? "Could not update the habit." : "Could not create the habit."));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="w-full flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
      {isEdit && onRequestArchive ? (
        <button
          type="button"
          onClick={() => habit && onRequestArchive(habit)}
          disabled={saving}
          className="min-h-11 px-4 rounded-xl text-sm font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          <Archive className="w-4 h-4" aria-hidden="true" />
          <span>Archive habit</span>
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          disabled={saving}
          className="min-h-11 px-4 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="habit-form"
          disabled={!canSave}
          aria-busy={saving}
          className="min-h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-sm font-black transition cursor-pointer flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          <span>{isEdit ? "Save changes" : "Save habit"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? "Edit habit" : "Create new habit"}
      size="md"
      footer={footer}
      closeOnBackdropClick={!saving}
    >
      <form id="habit-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <div id={ids.error} role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={ids.name} className={cn(FIELD_LABEL, "mb-1.5")}>
            Habit name & emoji
          </label>
          <div className="flex items-center gap-2.5">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={toggleEmoji}
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 transition cursor-pointer shrink-0"
              style={{ boxShadow: `0 0 12px -2px ${previewColor}33` }}
              aria-label={`Choose emoji (current: ${emoji})`}
              aria-haspopup="dialog"
              aria-expanded={emojiOpen}
            >
              {emoji}
            </button>
            <Input
              id={ids.name}
              type="text"
              required
              value={name}
              maxLength={HABIT_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 20 pages"
              isInvalid={Boolean(error) && !trimmedName}
              aria-describedby={error ? ids.error : undefined}
              containerClassName="flex-1 min-w-0"
            />
          </div>
          {emojiRendered &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                ref={emojiPanelRef}
                role="dialog"
                aria-label="Choose an emoji"
                {...{ [OVERLAY_ROOT_ATTRIBUTE]: "" }}
                style={emojiStyle}
                className={cn(
                  "h-[435px] w-[352px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-[0_15px_50px_rgba(0,0,0,0.8)] transition duration-150 ease-out",
                  emojiSide === "top" ? "origin-bottom" : "origin-top",
                  emojiPlaced && emojiEntering && !emojiLeaving
                    ? "opacity-100 scale-100 pointer-events-auto"
                    : "opacity-0 scale-95 pointer-events-none"
                )}
              >
                <EmojiPicker
                  data={data}
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="none"
                  maxFrequentRows={1}
                  onEmojiSelect={(selection: { native?: string }) => {
                    if (selection?.native) setEmoji(selection.native);
                    closeEmoji();
                  }}
                />
              </div>,
              document.body
            )}
        </div>

        <div>
          <Textarea
            id={ids.description}
            label={
              <>
                Description <span className="font-normal text-zinc-500">(optional)</span>
              </>
            }
            rows={3}
            value={description}
            maxLength={HABIT_DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why it matters, or how you'll do it"
            aria-describedby={showDescriptionCount ? ids.descriptionCount : undefined}
          />
          {showDescriptionCount && (
            <p
              id={ids.descriptionCount}
              aria-live="polite"
              className={cn(
                "mt-1.5 text-xs text-end tabular-nums",
                description.length >= HABIT_DESCRIPTION_MAX ? "text-amber-400" : "text-zinc-400"
              )}
            >
              {description.length}/{HABIT_DESCRIPTION_MAX}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-2">
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Accent colour</span>
          </legend>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {HABIT_COLOR_PRESETS.map((preset) => {
              const selected = color === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColorText(preset)}
                  aria-label={`Use colour ${preset}`}
                  aria-pressed={selected}
                  className={cn(
                    "w-11 h-11 rounded-xl transition-transform cursor-pointer",
                    selected ? "ring-[1.5px] ring-white ring-offset-2 ring-offset-zinc-900" : "opacity-85 hover:opacity-100"
                  )}
                  style={{ backgroundColor: preset }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2.5">
            <label htmlFor={ids.color} className="sr-only">
              Pick a custom colour
            </label>
            <input
              id={ids.color}
              type="color"
              value={previewColor}
              onChange={(e) => setColorText(e.target.value)}
              className="w-11 h-11 rounded-xl border border-zinc-700 bg-transparent cursor-pointer shrink-0"
            />
            <label htmlFor={ids.colorText} className="sr-only">
              Hex colour
            </label>
            <Input
              id={ids.colorText}
              type="text"
              value={colorText}
              onChange={(e) => setColorText(e.target.value)}
              placeholder="#10b981"
              maxLength={7}
              isInvalid={!color}
              containerClassName="flex-1 min-w-0"
              inputClassName="font-mono"
            />
          </div>
          {!color && <p className="mt-1.5 text-xs text-amber-400">Enter a hex colour such as #10b981.</p>}
        </fieldset>

        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Preview</span>
          <div
            className="flex items-center gap-3 p-3.5 rounded-2xl border bg-zinc-800/40"
            style={{ borderColor: `${previewColor}44`, boxShadow: `0 0 16px -4px ${previewColor}22` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: `${previewColor}18`, border: `1px solid ${previewColor}33` }}
              aria-hidden="true"
            >
              {emoji || DEFAULT_HABIT_EMOJI}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-zinc-100 truncate">{trimmedName || "Habit name"}</p>
              {trimmedDescription ? (
                <p className="text-xs text-zinc-400 line-clamp-2 break-words">{trimmedDescription}</p>
              ) : (
                <p className="text-xs font-medium" style={{ color: previewColor }}>
                  Daily habit
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
