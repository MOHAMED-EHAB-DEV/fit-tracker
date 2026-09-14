"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Sparkles, CalendarClock, Loader2 } from "lucide-react";
import PlannerDayPicker from "./PlannerDayPicker";
import PlannerTimeline from "./PlannerTimeline";
import EventDrawer from "./EventDrawer";
import AddEventModal from "./AddEventModal";
import AIPlannerModal from "./AIPlannerModal";
import { PlannedEventItem, HabitOption, EventCategory, sortEventsByPlannerTime } from "./types";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

interface PlannerPageProps {
  initialDate: string;
  initialEvents: PlannedEventItem[];
  availableHabits: HabitOption[];
}

export default function PlannerPage({
  initialDate,
  initialEvents,
  availableHabits,
}: PlannerPageProps) {
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [events, setEvents] = useState<PlannedEventItem[]>(initialEvents);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Drawer & Modals state
  const [selectedEvent, setSelectedEvent] = useState<PlannedEventItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);

  // Fetch events when selectedDate changes (after initial mount)
  const fetchEventsForDate = useCallback(
    async (dateStr: string) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/planner?date=${dateStr}`);
        const data = await res.json();
        if (data.success) {
          setEvents(data.events || []);
        } else {
          toast(data.error || "Failed to load events", "error");
        }
      } catch (err: any) {
        toast(err.message || "Failed to load day events", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchEventsForDate(newDate);
  };

  // Toggle completion with optimistic UI
  const handleToggleComplete = async (event: PlannedEventItem) => {
    const nextStatus = !event.isCompleted;

    // Optimistic local update
    setEvents((prev) =>
      prev.map((e) => (e._id === event._id ? { ...e, isCompleted: nextStatus } : e))
    );
    if (selectedEvent && selectedEvent._id === event._id) {
      setSelectedEvent((prev) => (prev ? { ...prev, isCompleted: nextStatus } : null));
    }

    try {
      const res = await fetch(`/api/planner/${event._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: nextStatus, targetDate: selectedDate }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update completion");
      }

      // Sync updated item
      setEvents((prev) =>
        prev.map((e) => (e._id === event._id ? data.event : e))
      );
      if (selectedEvent && selectedEvent._id === event._id) {
        setSelectedEvent(data.event);
      }

      toast(
        nextStatus
          ? `Completed "${event.title}"`
          : `Marked "${event.title}" as incomplete`,
        "success"
      );
    } catch (err: any) {
      // Revert optimistic update
      setEvents((prev) =>
        prev.map((e) => (e._id === event._id ? { ...e, isCompleted: !nextStatus } : e))
      );
      toast(err.message || "Could not update status", "error");
    }
  };

  const handleSelectEvent = (event: PlannedEventItem) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const handleUpdateEvent = async (id: string, updates: Partial<PlannedEventItem>) => {
    try {
      const res = await fetch(`/api/planner/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updates, targetDate: selectedDate }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update event");
      }

      setEvents((prev) =>
        sortEventsByPlannerTime(prev.map((e) => (e._id === id ? data.event : e)))
      );
      setSelectedEvent(data.event);
      toast("Event updated successfully", "success");
    } catch (err: any) {
      toast(err.message || "Failed to update event", "error");
      throw err;
    }
  };

  const handleDeleteEvent = async (id: string, mode?: "this" | "all") => {
    try {
      const query = mode === "this" ? `?mode=this&date=${selectedDate}` : "?mode=all";
      const res = await fetch(`/api/planner/${id}${query}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete event");
      }

      setEvents((prev) => prev.filter((e) => e._id !== id));
      if (selectedEvent?._id === id) {
        setSelectedEvent(null);
        setIsDrawerOpen(false);
      }
      toast(mode === "this" ? "Removed for this day" : "Event deleted", "info");
    } catch (err: any) {
      toast(err.message || "Failed to delete event", "error");
      throw err;
    }
  };

  const handleAddEvent = async (eventData: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    category: EventCategory;
    color: string;
    recurrence: any;
    linkedHabitIds: string[];
  }) => {
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          ...eventData,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create event");
      }

      setEvents((prev) =>
        sortEventsByPlannerTime([...prev, data.event])
      );
      toast(`Added "${eventData.title}" to ${selectedDate}`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to add event", "error");
      throw err;
    }
  };

  const handleApplySchedule = async (
    generatedEvents: any[],
    replaceExisting: boolean
  ) => {
    try {
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          events: generatedEvents,
          replaceExisting,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to apply schedule");
      }

      setEvents(data.events || []);
      toast(`Applied ${generatedEvents.length} events to your day!`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to apply AI schedule", "error");
      throw err;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100 tracking-tight">
                Day Planner
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Precision time-block execution synchronized with your daily fitness habits
              </p>
            </div>
          </div>
        </div>

        {/* Action button on desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant="flat"
            size="md"
            onClick={() => setIsAIModalOpen(true)}
            startContent={<Sparkles className="w-4 h-4 text-emerald-400" />}
          >
            AI Day Architect
          </Button>
          <Button
            variant="solid"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            startContent={<Plus className="w-4 h-4" />}
          >
            Add Event
          </Button>
        </div>
      </div>

      {/* Date Navigator */}
      <PlannerDayPicker
        selectedDate={selectedDate}
        onSelectDate={handleDateChange}
      />

      {/* Loading state indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-75 gap-2 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span className="text-sm font-medium">Loading schedule...</span>
        </div>
      ) : (
        /* Timeline */
        <PlannerTimeline
          events={events}
          selectedDate={selectedDate}
          onToggleComplete={handleToggleComplete}
          onSelectEvent={handleSelectEvent}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenAIModal={() => setIsAIModalOpen(true)}
        />
      )}

      {/* Left-Side Event Drawer */}
      <EventDrawer
        event={selectedEvent}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedEvent(null);
        }}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
        onToggleComplete={handleToggleComplete}
        availableHabits={availableHabits}
      />

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddEvent={handleAddEvent}
        availableHabits={availableHabits}
        targetDate={selectedDate}
      />

      {/* AI Planner Modal */}
      <AIPlannerModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        targetDate={selectedDate}
        availableHabits={availableHabits}
        onApplySchedule={handleApplySchedule}
      />

      {/* Floating Action Button for Mobile */}
      <div className="sm:hidden fixed bottom-20 inset-e-5 z-40">
        <Button
          variant="solid"
          size="lg"
          radius="full"
          onClick={() => setIsAddModalOpen(true)}
          className="shadow-xl shadow-emerald-500/30 p-4"
          aria-label="Add Event"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
