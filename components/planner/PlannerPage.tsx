"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sparkles, CalendarClock, Loader2, AlertCircle, RotateCw } from "lucide-react";
import PlannerDayPicker from "./PlannerDayPicker";
import PlannerTimeline from "./PlannerTimeline";
import EventDrawer, { DeleteMode } from "./EventDrawer";
import AddEventModal from "./AddEventModal";
import AIPlannerModal from "./AIPlannerModal";
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
import { syncPlannerReminders } from "@/services/planner-reminders";

interface PlannerPageProps {
  initialDate: string;
  initialEvents: PlannedEventItem[];
  availableHabits: HabitOption[];
  timeZone: string;
}

type LoadState = { status: "ready" } | { status: "loading" } | { status: "error"; message: string };

function afterPlannerChange() {
  syncPlannerReminders().catch(() => undefined);
}

export default function PlannerPage({ initialDate, initialEvents, availableHabits, timeZone }: PlannerPageProps) {
  const { toast } = useToast();
  const { today, time: nowTime } = useToday(timeZone, initialDate);

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [events, setEvents] = useState<PlannedEventItem[]>(initialEvents);
  const [loadState, setLoadState] = useState<LoadState>({ status: "ready" });
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<string>>(new Set());

  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  const [drawerSnapshot, setDrawerSnapshot] = useState<PlannedEventItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiModalKey, setAiModalKey] = useState(0);

  const selectedDateRef = useRef(selectedDate);
  // Counts day loads; a response from an older load is ignored (requests are never aborted).
  const loadSeqRef = useRef(0);
  const togglingRef = useRef(new Set<string>());
  const lastTodayRef = useRef(initialDate);

  // The drawer follows the live list; the snapshot keeps it filled while it animates closed.
  const drawerEvent = events.find((event) => event._id === drawerEventId) || drawerSnapshot;

  const loadDate = useCallback(async (date: string) => {
    const seq = ++loadSeqRef.current;
    selectedDateRef.current = date;
    setSelectedDate(date);
    setLoadState({ status: "loading" });
    setIsDrawerOpen(false);

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
    setDrawerEventId(event._id);
    setDrawerSnapshot(event);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (drawerEvent) setDrawerSnapshot(drawerEvent);
    setIsDrawerOpen(false);
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
      setDrawerSnapshot(result.data.event);
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
      closeDrawer();
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CalendarClock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">Day Planner</h1>
            <p className="text-sm text-zinc-400 mt-0.5">Time-block your day and link blocks to your habits</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <Button variant="flat" size="md" onClick={openAIModal} startContent={<Sparkles className="w-4 h-4" />}>
            Plan with AI
          </Button>
          <Button variant="solid" size="md" onClick={() => setIsAddModalOpen(true)} startContent={<Plus className="w-4 h-4" />}>
            Add event
          </Button>
        </div>
      </div>

      <PlannerDayPicker selectedDate={selectedDate} today={today} onSelectDate={(date) => void loadDate(date)} />

      <section aria-busy={isLoading} aria-label="Schedule" className="relative">
        {isLoading && (
          <div role="status" className="absolute top-2 inset-e-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" aria-hidden="true" />
            Loading...
          </div>
        )}
        {loadState.status === "error" ? (
          <div role="alert" className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/20 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-6 h-6 text-rose-400" aria-hidden="true" />
            <p className="text-sm text-zinc-200">{loadState.message}</p>
            <Button variant="bordered" size="md" onClick={() => void loadDate(selectedDate)} startContent={<RotateCw className="w-4 h-4" />}>
              Try again
            </Button>
          </div>
        ) : (
          <div className={isLoading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
            <PlannerTimeline
              events={events}
              selectedDate={selectedDate}
              isToday={selectedDate === today}
              nowTime={nowTime}
              togglingIds={togglingIds}
              onToggleComplete={handleToggleComplete}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}
      </section>

      <EventDrawer
        event={drawerEvent}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        onToggleComplete={handleToggleComplete}
        isToggling={drawerEvent ? togglingIds.has(drawerEvent._id) : false}
        availableHabits={availableHabits}
      />

      <AddEventModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddEvent={handleAddEvent}
        availableHabits={availableHabits}
        targetDate={selectedDate}
      />

      <AIPlannerModal
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
