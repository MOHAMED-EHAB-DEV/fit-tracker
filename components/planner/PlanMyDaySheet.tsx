"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { SuggestedCard } from "@/components/ui/SuggestedCard";
import { Textarea } from "@/components/ui/Textarea";
import { CATEGORY_CONFIG, HabitOption, PlannedEventItem, RECURRENCE_OPTIONS, RecurrenceType, readApiResponse } from "./types";
import type { AiPlanEvent } from "@/lib/planner/ai-plan";
import { formatDateString } from "@/lib/time";

const REPEAT_OPTIONS: SelectOption<RecurrenceType>[] = RECURRENCE_OPTIONS.map((option) => ({
  value: option.value,
  label: option.value === "once" ? "Only this day" : option.label,
}));

interface PlanMyDaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  /** The day's events now (until the server sends its own list). */
  existingEvents: PlannedEventItem[];
  availableHabits: HabitOption[];
  /** Adds events (and removes the given one-time events); resolves to an error message or null. */
  onApplySchedule: (events: AiPlanEvent[], replaceEventIds: string[]) => Promise<string | null>;
}

interface GenerateResponse extends Record<string, unknown> {
  summary: string;
  events: AiPlanEvent[];
  existingEvents: PlannedEventItem[];
}

interface Suggestion {
  key: string;
  event: AiPlanEvent;
  state: "suggested" | "applied";
}

/**
 * Plan my day: the coach suggests events for the day; each one waits in a
 * Suggested card to be accepted or dismissed (or all at once). Nothing is
 * added before the user accepts it.
 */
export default function PlanMyDaySheet({
  isOpen,
  onClose,
  targetDate,
  existingEvents,
  availableHabits,
  onApplySchedule,
}: PlanMyDaySheetProps) {
  const [notes, setNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [dayEvents, setDayEvents] = useState<PlannedEventItem[]>(existingEvents);
  const [replace, setReplace] = useState(false);
  const [replaceIds, setReplaceIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const dayLabel = formatDateString(targetDate, { weekday: "long", month: "long", day: "numeric" });
  const habitById = (id: string) => availableHabits.find((habit) => habit._id === id);
  const replaceable = dayEvents.filter((event) => event.recurrence === "once");
  const pending = (suggestions ?? []).filter((suggestion) => suggestion.state === "suggested");
  const busy = isGenerating || applyingKey !== null;

  const generate = async () => {
    if (busy) return;
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
      setSuggestions(
        result.data.events.map((event, index) => ({ key: `${index}-${event.startTime}-${event.title}`, event, state: "suggested" }))
      );
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

  const accept = async (items: Suggestion[], removeIds: string[]) => {
    if (busy || items.length === 0) return;
    setApplyingKey(items.length === 1 ? items[0].key : "all");
    setError(null);
    const failure = await onApplySchedule(
      items.map((item) => item.event),
      removeIds
    );
    setApplyingKey(null);
    if (failure) {
      setError(failure);
      return;
    }
    const accepted = new Set(items.map((item) => item.key));
    setSuggestions((current) => (current ?? []).map((item) => (accepted.has(item.key) ? { ...item, state: "applied" } : item)));
    if (removeIds.length > 0) {
      setDayEvents((current) => current.filter((event) => !removeIds.includes(event._id)));
      setReplace(false);
      setReplaceIds(new Set());
    }
  };

  const setRepeat = (key: string, recurrence: RecurrenceType) =>
    setSuggestions((current) => (current ?? []).map((item) => (item.key === key ? { ...item, event: { ...item.event, recurrence } } : item)));

  const close = () => {
    if (applyingKey) return;
    cancelGenerate();
    onClose();
  };

  const footer = isGenerating ? (
    <Button variant="secondary" fullWidth onClick={cancelGenerate}>
      Cancel
    </Button>
  ) : suggestions === null ? (
    <Button size="lg" fullWidth startContent={<Sparkles className="h-4 w-4" />} onClick={() => void generate()}>
      Suggest a plan
    </Button>
  ) : pending.length > 0 ? (
    <div className="grid w-full grid-cols-[auto_1fr] gap-2">
      <Button variant="ghost" disabled={busy} onClick={() => void generate()}>
        Regenerate
      </Button>
      <Button
        isLoading={applyingKey === "all"}
        disabled={busy}
        onClick={() => void accept(pending, replace ? Array.from(replaceIds) : [])}
      >
        {pending.length === 1
          ? "Accept the last one"
          : replace && replaceIds.size > 0
            ? `Accept all ${pending.length}, remove ${replaceIds.size}`
            : `Accept all ${pending.length}`}
      </Button>
    </div>
  ) : (
    <div className="grid w-full grid-cols-2 gap-2">
      <Button variant="secondary" onClick={() => void generate()}>
        Suggest again
      </Button>
      <Button onClick={close}>Done</Button>
    </div>
  );

  return (
    <Sheet
      isOpen={isOpen}
      onClose={close}
      title="Plan my day"
      description={`Suggested events for ${dayLabel}. Nothing is added until you accept it.`}
      footer={footer}
      size="lg"
    >
      <div className="space-y-3">
        <Textarea
          id="plan-my-day-notes"
          label="Anything to plan around? (optional)"
          rows={2}
          maxLength={500}
          value={notes}
          disabled={busy}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Leg day in the afternoon, a call at 15:00, in bed by 22:30"
        />

        {error && (
          <p role="alert" className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        {isGenerating && <SuggestedCard meta="Planning the day" isLoading>{null}</SuggestedCard>}

        {!isGenerating && suggestions !== null && (
          <>
            {summary && <p className="text-[13px] leading-5 text-ink-2">{summary}</p>}
            {suggestions.length === 0 && <p className="text-sm text-ink-2">No events were suggested. Add a note and try again.</p>}
            <ul className="space-y-2" aria-label="Suggested events">
              {suggestions.map((item) => {
                const config = CATEGORY_CONFIG[item.event.category] || CATEGORY_CONFIG.other;
                const habits = item.event.linkedHabitIds.map(habitById).filter((habit): habit is HabitOption => Boolean(habit));
                return (
                  <li key={item.key}>
                    <SuggestedCard
                      meta={config.label}
                      state={item.state}
                      isAccepting={applyingKey === item.key}
                      onAccept={() => void accept([item], [])}
                      onDismiss={() => setSuggestions((current) => (current ?? []).filter((entry) => entry.key !== item.key))}
                    >
                      <p className="font-mono text-xs tabular-nums text-ink-2">
                        {item.event.startTime}
                        {item.event.endTime ? ` – ${item.event.endTime}` : ""}
                      </p>
                      <p className="mt-0.5 text-[15px] font-semibold text-ink">{item.event.title}</p>
                      {item.event.description && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{item.event.description}</p>}
                      {habits.length > 0 && (
                        <p className="mt-1 text-xs text-ink-3">Ticks {habits.map((habit) => `${habit.emoji} ${habit.name}`).join(", ")}</p>
                      )}
                      {item.state === "suggested" && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-ink-3">Repeats</span>
                          <Select<RecurrenceType>
                            ariaLabel={`Repeats: ${item.event.title}`}
                            options={REPEAT_OPTIONS}
                            value={item.event.recurrence}
                            onChange={(value) => setRepeat(item.key, value)}
                            size="sm"
                            className="w-40"
                          />
                        </div>
                      )}
                    </SuggestedCard>
                  </li>
                );
              })}
            </ul>

            {pending.length > 1 && replaceable.length > 0 && (
              <div className="space-y-1 rounded-control border border-line bg-surface p-3">
                <Checkbox
                  checked={replace}
                  onChange={(event) => {
                    setReplace(event.target.checked);
                    setReplaceIds(event.target.checked ? new Set(replaceable.map((item) => item._id)) : new Set());
                  }}
                  label="With Accept all, remove some of my one-time events for this day"
                />
                {replace && (
                  <ul className="space-y-0.5 ps-1" aria-label="Events that will be removed">
                    {replaceable.map((item) => (
                      <li key={item._id}>
                        <Checkbox
                          checked={replaceIds.has(item._id)}
                          onChange={() =>
                            setReplaceIds((current) => {
                              const next = new Set(current);
                              if (next.has(item._id)) next.delete(item._id);
                              else next.add(item._id);
                              return next;
                            })
                          }
                          label={
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="font-mono text-xs tabular-nums text-ink-3">{item.startTime}</span>
                              <span className="truncate">{item.title}</span>
                            </span>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
