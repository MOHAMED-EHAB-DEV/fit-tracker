"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RotateCw, Sparkles } from "lucide-react";
import PlannerTimeline from "./PlannerTimeline";
import EventSheet, { type DeleteMode, type EventSheetState } from "./EventSheet";
import PlanMyDaySheet from "./PlanMyDaySheet";
import { WeekStrip } from "./WeekStrip";
import { useToday } from "./useToday";
import {
  EventFormValues,
  HabitOption,
  PlannedEventItem,
  readApiResponse,
  sortEventsByPlannerTime,
} from "./types";
import type { AiPlanEvent } from "@/lib/planner/ai-plan";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { PlanTabs } from "@/components/planner/PlanTabs";
import { syncPlannerReminders } from "@/services/planner-reminders";
import { addDays, formatDateString, type WeekdayKey } from "@/lib/time";

interface PlannerPageProps {
  initialDate: string;
  initialEvents: PlannedEventItem[];
  availableHabits: HabitOption[];
  timeZone: string;
  weekStartDay: WeekdayKey;
}

type LoadState = { status: "ready" } | { status: "loading" } | { status: "error"; message: string };

function afterPlannerChange() {
  syncPlannerReminders().catch(() => undefined);
}

/** Plan › Schedule: the week, the day's events in time order, one sheet per event, Plan my day. */
export default function PlannerPage({ initialDate, initialEvents, availableHabits, timeZone, weekStartDay }: PlannerPageProps) {
  const { toast } = useToast();
  const { today, time: nowTime } = useToday(timeZone, initialDate);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [events, setEvents] = useState<PlannedEventItem[]>(initialEvents);
  const [loadState, setLoadState] = useState<LoadState>({ status: "ready" });
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set());

  // The event sheet: what it shows stays set while it slides away.
  const [sheetState, setSheetState] = useState<EventSheetState>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiModalKey, setAiModalKey] = useState(0);

  const selectedDateRef = useRef(selectedDate);
  // Counts day loads; a response from an older load is ignored (requests are never aborted).
  const loadSeqRef = useRef(0);
  const togglingRef = useRef(new Set<string>());
  const lastTodayRef = useRef(initialDate);

  // An open event follows the live list (done ticks, edits).
  const sheetEvent =
    sheetState?.mode === "event" ? events.find((event) => event._id === sheetState.event._id) || sheetState.event : null;
  const liveSheetState: EventSheetState = sheetState?.mode === "event" && sheetEvent ? { mode: "event", event: sheetEvent } : sheetState;

  const loadDate = useCallback(async (date: string) => {
    const seq = ++loadSeqRef.current;
    selectedDateRef.current = date;
    setSelectedDate(date);
    setLoadState({ status: "loading" });
    setIsSheetOpen(false);

    try {
      const res = await fetch(`/api/planner?date=${encodeURIComponent(date)}`);
      const result = await readApiResponse<{ events: PlannedEventItem[] }>(res);
      if (loadSeqRef.current !== seq || selectedDateRef.current !== date) return;
      if (result.ok) {
        setEvents(result.data.events);
        setLoadState({ status: "ready" });
      } else {
        setEvents([]);
        setLoadState({ status: "error", message: result.error });
      }
    } catch {
      if (loadSeqRef.current !== seq || selectedDateRef.current !== date) return;
      setEvents([]);
      setLoadState({ status: "error", message: "Could not load this day. Check your connection and try again." });
    }
  }, []);

  // Leaving the page invalidates any load still in flight.
  useEffect(
    () => () => {
      loadSeqRef.current += 1;
    },
    []
  );

  // After midnight, move a planner that was showing "today" on to the new day.
  useEffect(() => {
    const previous = lastTodayRef.current;
    if (today === previous) return;
    lastTodayRef.current = today;
    if (selectedDateRef.current === previous) void loadDate(today);
  }, [today, loadDate]);

  const replaceEvent = (updated: PlannedEventItem, date: string) => {
    if (selectedDateRef.current !== date) return;
    setEvents((prev) => sortEventsByPlannerTime(prev.map((event) => (event._id === updated._id ? updated : event))));
  };

  const setToggling = (id: string, on: boolean) => {
    if (on) togglingRef.current.add(id);
    else togglingRef.current.delete(id);
    setTogglingIds(new Set(togglingRef.current));
  };

  const handleToggleComplete = async (event: PlannedEventItem) => {
    if (togglingRef.current.has(event._id)) return;
    const date = event.occurrenceDate;
    const next = !event.isCompleted;
    setToggling(event._id, true);
    setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, isCompleted: next } : e)));

    let error: string | null = null;
    try {
      const res = await fetch(`/api/planner/${event._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: next, targetDate: date }),
      });
      const result = await readApiResponse<{ event: PlannedEventItem }>(res);
      if (result.ok) replaceEvent(result.data.event, date);
      else error = result.error;
    } catch {
      error = "Could not reach the server. Your change was not saved.";
    }

    if (error) {
      if (selectedDateRef.current === date) {
        setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, isCompleted: !next } : e)));
      }
      toast(error, "error");
    } else {
      afterPlannerChange();
    }
    setToggling(event._id, false);
  };

  const handleSelectEvent = (event: PlannedEventItem) => {
    setSheetState({ mode: "event", event });
    setIsSheetOpen(true);
  };

  const openCreate = () => {
    setSheetState({ mode: "create" });
    setIsSheetOpen(true);
  };

  const closeSheet = () => {
    if (sheetState?.mode === "event" && sheetEvent) setSheetState({ mode: "event", event: sheetEvent });
    setIsSheetOpen(false);
  };

  const handleUpdateEvent = async (id: string, values: EventFormValues): Promise<string | null> => {
    const date = selectedDateRef.current;
    try {
      const res = await fetch(`/api/planner/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, targetDate: date }),
      });
      const result = await readApiResponse<{ event: PlannedEventItem }>(res);
      if (!result.ok) return result.error;
      replaceEvent(result.data.event, date);
      setSheetState({ mode: "event", event: result.data.event });
      toast("Event saved", "success");
      afterPlannerChange();
      return null;
    } catch {
      return "Could not reach the server. Your changes were not saved.";
    }
  };

  const handleDeleteEvent = async (id: string, mode: DeleteMode): Promise<string | null> => {
    const date = selectedDateRef.current;
    try {
      const params = new URLSearchParams({ mode, date });
      const res = await fetch(`/api/planner/${id}?${params.toString()}`, { method: "DELETE" });
      const result = await readApiResponse<{ deleted: string }>(res);
      if (!result.ok) return result.error;
      if (selectedDateRef.current === date) setEvents((prev) => prev.filter((event) => event._id !== id));
      closeSheet();
      toast(mode === "this" ? "Removed from this day" : mode === "following" ? "Removed from this day onwards" : "Event deleted", "success");
      afterPlannerChange();
      return null;
    } catch {
      return "Could not reach the server. Nothing was deleted.";
    }
  };

  const handleAddEvent = async (values: EventFormValues): Promise<string | null> => {
    const date = selectedDateRef.current;
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, date }),
      });
      const result = await readApiResponse<{ event: PlannedEventItem }>(res);
      if (!result.ok) return result.error;
      if (selectedDateRef.current === date) {
        setEvents((prev) => sortEventsByPlannerTime([...prev, result.data.event]));
      }
      toast(`Added "${values.title}"`, "success");
      afterPlannerChange();
      return null;
    } catch {
      return "Could not reach the server. The event was not added.";
    }
  };

  const handleApplySchedule = async (planEvents: AiPlanEvent[], replaceEventIds: string[]): Promise<string | null> => {
    const date = selectedDateRef.current;
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, events: planEvents, replaceEventIds }),
      });
      const result = await readApiResponse<{ events: PlannedEventItem[]; created: number; removed: number }>(res);
      if (!result.ok) return result.error;
      if (selectedDateRef.current === date) setEvents(result.data.events);
      const { created, removed } = result.data;
      toast(
        removed > 0 ? `Added ${created} events and removed ${removed}` : `Added ${created} event${created === 1 ? "" : "s"}`,
        "success"
      );
      afterPlannerChange();
      return null;
    } catch {
      return "Could not reach the server. The plan was not applied.";
    }
  };

  const openAIModal = () => {
    setAiModalKey((key) => key + 1);
    setIsAIModalOpen(true);
  };

  const isLoading = loadState.status === "loading";
  const isToday = selectedDate === today;
  const dayTitle = isToday
    ? "Today"
    : selectedDate === addDays(today, 1)
      ? "Tomorrow"
      : selectedDate === addDays(today, -1)
        ? "Yesterday"
        : formatDateString(selectedDate, { weekday: "long", month: "short", day: "numeric" });
  const doneCount = events.filter((event) => event.isCompleted).length;

  return (
    <div className="space-y-3 lg:mx-auto lg:max-w-[760px]">
      <PlanTabs active="schedule" className="w-full md:max-w-[300px]" />

      <WeekStrip selectedDate={selectedDate} today={today} weekStartDay={weekStartDay} onSelectDate={(date) => void loadDate(date)} />

      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-ink">{dayTitle}</h2>
          <p className="text-xs text-ink-3" aria-live="polite">
            {isLoading ? (
              "Loading…"
            ) : events.length > 0 ? (
              <>
                <span className="font-mono tabular-nums">
                  {doneCount} of {events.length}
                </span>{" "}
                done
              </>
            ) : (
              "Nothing planned"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openAIModal} startContent={<Sparkles className="h-3.5 w-3.5" />}>
            Plan my day
          </Button>
          <Button size="sm" onClick={openCreate} startContent={<Plus className="h-3.5 w-3.5" />}>
            Add event
          </Button>
        </div>
      </div>

      <section aria-busy={isLoading || undefined} aria-label="Schedule">
        {loadState.status === "error" ? (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-6 text-center">
            <p className="text-sm text-ink-2">{loadState.message}</p>
            <Button variant="secondary" onClick={() => void loadDate(selectedDate)} startContent={<RotateCw className="h-4 w-4" />}>
              Try again
            </Button>
          </div>
        ) : (
          <div className={isLoading ? "pointer-events-none opacity-50 transition-opacity" : "transition-opacity"}>
            <PlannerTimeline
              events={events}
              isToday={isToday}
              nowTime={nowTime}
              togglingIds={togglingIds}
              onToggleComplete={handleToggleComplete}
              onSelectEvent={handleSelectEvent}
              dayLabel={isToday ? "today" : formatDateString(selectedDate, { weekday: "long", month: "short", day: "numeric" })}
              emptyActions={
                <>
                  <Button variant="secondary" startContent={<Plus className="h-4 w-4" />} onClick={openCreate}>
                    Add event
                  </Button>
                  <Button variant="ghost" startContent={<Sparkles className="h-4 w-4" />} onClick={openAIModal}>
                    Plan my day
                  </Button>
                </>
              }
            />
          </div>
        )}
      </section>

      <EventSheet
        isOpen={isSheetOpen}
        state={liveSheetState}
        onClose={closeSheet}
        targetDate={selectedDate}
        onAdd={handleAddEvent}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        onToggleComplete={handleToggleComplete}
        isToggling={sheetEvent ? togglingIds.has(sheetEvent._id) : false}
        availableHabits={availableHabits}
      />

      <PlanMyDaySheet
        key={`${aiModalKey}-${selectedDate}`}
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        targetDate={selectedDate}
        existingEvents={events}
        availableHabits={availableHabits}
        onApplySchedule={handleApplySchedule}
      />
    </div>
  );
}
