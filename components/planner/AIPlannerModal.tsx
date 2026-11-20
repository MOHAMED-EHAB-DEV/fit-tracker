"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, AlertCircle, Layers, X, Trash2 } from "lucide-react";
import { CATEGORY_CONFIG, HabitOption, PlannedEventItem, RECURRENCE_OPTIONS, RecurrenceType, readApiResponse } from "./types";
import type { AiPlanEvent } from "@/lib/planner/ai-plan";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatDateString } from "@/lib/time";

const AI_RECURRENCE_OPTIONS: SelectOption<RecurrenceType>[] = RECURRENCE_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.value === "once" ? "Only this day" : opt.label,
}));

interface AIPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  /** The day's current events (used until the server sends its own list). */
  existingEvents: PlannedEventItem[];
  availableHabits: HabitOption[];
  /** Resolves to an error message, or null on success. */
  onApplySchedule: (events: AiPlanEvent[], replaceEventIds: string[]) => Promise<string | null>;
}

interface GenerateResponse extends Record<string, unknown> {
  summary: string;
  events: AiPlanEvent[];
  existingEvents: PlannedEventItem[];
}

export default function AIPlannerModal({
  isOpen,
  onClose,
  targetDate,
  existingEvents,
  availableHabits,
  onApplySchedule,
}: AIPlannerModalProps) {
  const [notes, setNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [plan, setPlan] = useState<AiPlanEvent[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dayEvents, setDayEvents] = useState<PlannedEventItem[]>(existingEvents);
  const [replace, setReplace] = useState(false);
  const [replaceIds, setReplaceIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const replaceable = dayEvents.filter((event) => event.recurrence === "once");
  const habitName = (id: string) => availableHabits.find((habit) => habit._id === id);
  const dayLabel = formatDateString(targetDate, { weekday: "long", month: "long", day: "numeric" });

  const generate = async () => {
    if (isGenerating || isApplying) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate, notes: notes.trim() }),
        signal: controller.signal,
      });
      const result = await readApiResponse<GenerateResponse>(res);
      if (controller.signal.aborted) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.data.summary || "");
      setPlan(result.data.events);
      setSelected(new Set(result.data.events.map((_, index) => index)));
      if (Array.isArray(result.data.existingEvents)) setDayEvents(result.data.existingEvents);
      setReplace(false);
      setReplaceIds(new Set());
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsGenerating(false);
      }
    }
  };

  const cancelGenerate = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  };

  const toggleSelected = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const setRecurrence = (index: number, recurrence: RecurrenceType) =>
    setPlan((prev) => prev.map((event, i) => (i === index ? { ...event, recurrence } : event)));

  const toggleReplace = (checked: boolean) => {
    setReplace(checked);
    setReplaceIds(checked ? new Set(replaceable.map((event) => event._id)) : new Set());
  };

  const toggleReplaceId = (id: string) =>
    setReplaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (isApplying || isGenerating) return;
    const chosen = plan.filter((_, index) => selected.has(index));
    if (chosen.length === 0) return;
    setIsApplying(true);
    setError(null);
    const failure = await onApplySchedule(chosen, replace ? Array.from(replaceIds) : []);
    setIsApplying(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  const close = () => {
    if (isApplying) return;
    cancelGenerate();
    onClose();
  };

  const removalCount = replace ? replaceIds.size : 0;

  const footer =
    plan.length > 0 ? (
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 w-full">
        <Button variant="ghost" size="md" onClick={generate} disabled={isGenerating || isApplying}>
          Regenerate
        </Button>
        <Button
          variant="solid"
          size="md"
          isLoading={isApplying}
          disabled={selected.size === 0 || isGenerating}
          onClick={apply}
          startContent={<Layers className="w-4 h-4" />}
        >
          {removalCount > 0
            ? `Add ${selected.size}, remove ${removalCount}`
            : `Add ${selected.size} event${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>
    ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          Plan with AI
        </span>
      }
      description={`A suggested schedule for ${dayLabel}. Nothing is saved until you apply it.`}
      footer={footer}
      size="lg"
    >
      <div className="space-y-4">
        <Textarea
          id="ai-plan-notes"
          label="Anything to plan around? (optional)"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Leg day in the afternoon, team call at 15:00, in bed by 22:30"
        />

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {isGenerating ? (
          <div role="status" className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col items-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" aria-hidden="true" />
            <p className="text-sm font-medium text-zinc-200">Building a plan around your day...</p>
            <Button variant="bordered" size="md" onClick={cancelGenerate} startContent={<X className="w-4 h-4" />}>
              Cancel
            </Button>
          </div>
        ) : (
          plan.length === 0 && (
            <Button variant="solid" size="lg" onClick={generate} className="w-full" startContent={<Sparkles className="w-4 h-4" />}>
              Suggest a plan
            </Button>
          )
        )}

        {plan.length > 0 && !isGenerating && (
          <div className="space-y-4">
            {summary && (
              <p className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-200 leading-relaxed">
                {summary}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span>
                {selected.size} of {plan.length} selected
              </span>
              <button
                type="button"
                onClick={() => setSelected(selected.size === plan.length ? new Set() : new Set(plan.map((_, i) => i)))}
                className="min-h-11 px-2 text-emerald-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
              >
                {selected.size === plan.length ? "Deselect all" : "Select all"}
              </button>
            </div>

            <ul className="space-y-2 max-h-80 overflow-y-auto pe-1" aria-label="Suggested events">
              {plan.map((event, index) => {
                const isSelected = selected.has(index);
                const cfg = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
                return (
                  <li
                    key={`${index}-${event.startTime}-${event.title}`}
                    className={`rounded-xl border transition-colors ${
                      isSelected ? "bg-zinc-900 border-zinc-700" : "bg-zinc-950/60 border-zinc-800/60"
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      onClick={() => toggleSelected(index)}
                      className="w-full flex items-start gap-3 p-3 text-start rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      <span
                        className={`w-6 h-6 rounded-md border flex items-center justify-center mt-0.5 shrink-0 ${
                          isSelected ? "bg-emerald-500 border-emerald-400 text-zinc-950" : "border-zinc-600 bg-zinc-800"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-3" />}
                      </span>
                      <span className={`flex-1 min-w-0 ${isSelected ? "" : "opacity-60"}`}>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-zinc-300">
                            {event.startTime}
                            {event.endTime && ` → ${event.endTime}`}
                          </span>
                          <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${cfg.badgeBg} ${cfg.badgeText}`}>{cfg.label}</span>
                        </span>
                        <span className="block text-sm font-semibold text-zinc-100 mt-0.5 break-words">{event.title}</span>
                        {event.description && <span className="block text-sm text-zinc-400 mt-0.5">{event.description}</span>}
                        {event.linkedHabitIds.length > 0 && (
                          <span className="block text-xs text-zinc-400 mt-1">
                            Ticks:{" "}
                            {event.linkedHabitIds
                              .map((id) => habitName(id))
                              .filter(Boolean)
                              .map((habit) => `${habit?.emoji} ${habit?.name}`)
                              .join(", ")}
                          </span>
                        )}
                      </span>
                    </button>
                    {isSelected && (
                      <div className="px-3 pb-3 flex items-center gap-2">
                        <label htmlFor={`ai-recur-${index}`} className="text-xs text-zinc-400">
                          Repeats
                        </label>
                        <Select<RecurrenceType>
                          id={`ai-recur-${index}`}
                          ariaLabel="Repeats"
                          options={AI_RECURRENCE_OPTIONS}
                          value={event.recurrence}
                          onChange={(value) => setRecurrence(index, value)}
                          size="sm"
                          className="w-44"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {replaceable.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
                <Checkbox
                  checked={replace}
                  onChange={(e) => toggleReplace(e.target.checked)}
                  label="Remove some of my one-time events for this day"
                  className="flex"
                />
                {replace && (
                  <ul className="space-y-1" aria-label="Events that will be removed">
                    {replaceable.map((event) => (
                      <li key={event._id}>
                        <Checkbox
                          checked={replaceIds.has(event._id)}
                          onChange={() => toggleReplaceId(event._id)}
                          className="flex px-2 rounded-lg hover:bg-zinc-900"
                          label={
                            <span className="flex items-center gap-3 min-w-0">
                              <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
                              <span className="font-mono text-xs text-zinc-400">{event.startTime}</span>
                              <span className="truncate">{event.title}</span>
                            </span>
                          }
                        />
                      </li>
                    ))}
                    <li className="text-xs text-zinc-400 px-2 pt-1">
                      Ticked events are deleted after the new plan is saved. Repeating events are never removed here.
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
