"use client";

import React, { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";
import { Archive, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { usePopover } from "@/hooks/usePopover";
import { useFloatingPosition } from "@/hooks/useFloatingPosition";
import { useTheme } from "@/hooks/useTheme";
import { OVERLAY_ROOT_ATTRIBUTE } from "@/lib/ui/overlay-stack";
import type { HabitDTO } from "@/lib/habits/dto";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_EMOJI, HABIT_COLOR_PRESETS, normalizeHexColor, safeHabitColor } from "@/lib/habits/colors";
import { HABIT_DESCRIPTION_MAX, HABIT_NAME_MAX } from "@/lib/validation/habits";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { errorMessage, requestJson, type HabitResponse } from "./api";

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div role="status" className="flex h-full items-center justify-center gap-2 p-8 text-ink-3">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-xs">Loading emoji…</span>
    </div>
  ),
});

interface HabitSheetProps {
  isOpen: boolean;
  /** The habit being edited; null creates a new habit. */
  habit: HabitDTO | null;
  onClose: () => void;
  onSaved: (habit: HabitDTO) => void;
  /** Edit only: archive (reversible, the page offers Undo). */
  onArchive?: (habit: HabitDTO) => void;
}

/** New habit / Edit habit: emoji and name, an optional description, its colour. */
export function HabitSheet(props: HabitSheetProps) {
  // A fresh form for every habit (or "new") that is opened.
  const key = props.isOpen ? props.habit?._id || "new" : "closed";
  return <HabitSheetInner key={key} {...props} />;
}

function HabitSheetInner({ isOpen, habit, onClose, onSaved, onArchive }: HabitSheetProps) {
  const isEdit = Boolean(habit);
  const { resolved } = useTheme();
  const ids = { name: useId(), description: useId(), color: useId(), colorText: useId() };
  const [name, setName] = useState(habit?.name || "");
  const [description, setDescription] = useState(habit?.description || "");
  const [emoji, setEmoji] = useState(habit?.emoji || DEFAULT_HABIT_EMOJI);
  const [colorText, setColorText] = useState(habit ? safeHabitColor(habit.color) : DEFAULT_HABIT_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

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
  const { style: emojiStyle, isReady: emojiPlaced } = useFloatingPosition({
    triggerRef: emojiButtonRef,
    floatingRef: emojiPanelRef,
    isOpen: emojiRendered,
    side: "bottom",
    align: "left",
    offset: 8,
  });

  const color = normalizeHexColor(colorText);
  const previewColor = color ?? DEFAULT_HABIT_COLOR;
  const trimmedName = name.trim();

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!trimmedName) {
      setNameError("Give the habit a name.");
      return;
    }
    if (!color) return;
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ name: trimmedName, description: description.trim(), emoji: emoji || DEFAULT_HABIT_EMOJI, color });
      const result = await requestJson<HabitResponse>(habit ? `/api/habits/${habit._id}` : "/api/habits", {
        method: habit ? "PATCH" : "POST",
        body,
      });
      markDashboardStale();
      onSaved(result.habit);
      onClose();
    } catch (err) {
      setError(errorMessage(err, habit ? "Could not save the habit." : "Could not create the habit."));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      {isEdit && habit && onArchive ? (
        <Button variant="ghost" startContent={<Archive className="h-4 w-4" />} disabled={saving} onClick={() => onArchive(habit)}>
          Archive
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={close} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form="habit-form" isLoading={saving} disabled={!color}>
          {isEdit ? "Save" : "Create habit"}
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet isOpen={isOpen} onClose={close} title={isEdit ? "Edit habit" : "New habit"} footer={footer} closeOnBackdropClick={!saving}>
      <form id="habit-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <div>
          <label htmlFor={ids.name} className="mb-1.5 block text-[13px] font-medium text-ink-2">
            Emoji and name
          </label>
          <div className="flex items-start gap-2">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={toggleEmoji}
              aria-label={`Choose an emoji (now ${emoji})`}
              aria-haspopup="dialog"
              aria-expanded={emojiOpen}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-control border border-line bg-elevated text-2xl transition-colors hover:border-line-strong cursor-pointer"
            >
              {emoji}
            </button>
            <Input
              id={ids.name}
              type="text"
              value={name}
              maxLength={HABIT_NAME_MAX}
              data-autofocus
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Read 20 pages"
              isInvalid={Boolean(nameError)}
              errorMessage={nameError ?? undefined}
              containerClassName="min-w-0 flex-1"
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
                  "glass-float h-[435px] w-[352px] max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] overflow-hidden rounded-card transition duration-150 ease-out",
                  emojiPlaced && emojiEntering && !emojiLeaving ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                <EmojiPicker
                  data={data}
                  theme={resolved}
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

        <Textarea
          id={ids.description}
          label="Description (optional)"
          rows={2}
          value={description}
          maxLength={HABIT_DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Why it matters, or how you will do it"
          description={description.length >= HABIT_DESCRIPTION_MAX * 0.8 ? `${description.length} / ${HABIT_DESCRIPTION_MAX}` : undefined}
        />

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Colour</legend>
          <p className="mb-2 text-xs text-ink-3">Shown as a thin bar next to the habit.</p>
          <div className="flex flex-wrap items-center gap-2">
            {HABIT_COLOR_PRESETS.map((preset) => {
              const selected = color === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColorText(preset)}
                  aria-label={`Colour ${preset}`}
                  aria-pressed={selected}
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-control border-2 transition-colors cursor-pointer",
                    selected ? "border-ink" : "border-transparent hover:border-line-strong"
                  )}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-chip text-ink-inverse" style={{ backgroundColor: preset }}>
                    {selected && <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
            <label htmlFor={ids.color} className="sr-only">
              Pick a custom colour
            </label>
            <input
              id={ids.color}
              type="color"
              value={previewColor}
              onChange={(event) => setColorText(event.target.value)}
              className="h-10 w-10 shrink-0 cursor-pointer rounded-control border border-line bg-transparent p-1"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id={ids.colorText}
              aria-label="Colour as a hex value"
              type="text"
              value={colorText}
              onChange={(event) => setColorText(event.target.value)}
              placeholder={DEFAULT_HABIT_COLOR}
              maxLength={7}
              isInvalid={!color}
              errorMessage={color ? undefined : `Use a hex colour such as ${DEFAULT_HABIT_COLOR}.`}
              containerClassName="w-40"
              inputClassName="font-mono"
            />
          </div>
        </fieldset>

        <div aria-hidden="true" className="flex items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-2.5">
          <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: previewColor }} />
          <span className="text-sm leading-none">{emoji || DEFAULT_HABIT_EMOJI}</span>
          <span className="truncate text-sm font-medium text-ink">{trimmedName || "Habit name"}</span>
        </div>
      </form>
    </Sheet>
  );
}

export default HabitSheet;
