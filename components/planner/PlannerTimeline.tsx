"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Sparkles, Calendar, CheckCircle2 } from "lucide-react";
import EventCard from "./EventCard";
import { PlannedEventItem, getPlannerTimeSortKey } from "./types";
import { isToday, parseISO, format } from "date-fns";
import { Button } from "@/components/ui/Button";

interface PlannerTimelineProps {
  events: PlannedEventItem[];
  selectedDate: string; // YYYY-MM-DD
  onToggleComplete: (event: PlannedEventItem) => void;
  onSelectEvent: (event: PlannedEventItem) => void;
  onOpenAddModal: () => void;
  onOpenAIModal: () => void;
}

export default function PlannerTimeline({
  events,
  selectedDate,
  onToggleComplete,
  onSelectEvent,
  onOpenAddModal,
  onOpenAIModal,
}: PlannerTimelineProps) {
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  const isSelectedToday = useMemo(() => {
    try {
      return isToday(parseISO(selectedDate));
    } catch {
      return false;
    }
  }, [selectedDate]);

  // Keep live time updated for "Now" indicator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(format(now, "HH:mm"));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Completion stats
  const totalCount = events.length;
  const completedCount = events.filter((e) => e.isCompleted).length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Find index where the "Now" line should sit chronologically (5 AM to 12 AM cycle)
  const nowIndex = useMemo(() => {
    if (!isSelectedToday || !currentTimeStr || events.length === 0) return -1;
    const nowKey = getPlannerTimeSortKey(currentTimeStr);
    let idx = 0;
    while (idx < events.length && getPlannerTimeSortKey(events[idx].startTime) <= nowKey) {
      idx++;
    }
    return idx;
  }, [isSelectedToday, currentTimeStr, events]);

  return (
    <div className="space-y-4">
      {/* Progress & Quick Actions Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">
                {completedCount} of {totalCount} Completed
              </span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-zinc-800 text-emerald-400 border border-zinc-700">
                {percent}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-36 sm:w-48 h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="bordered"
            size="sm"
            onClick={onOpenAIModal}
            className="flex-1 sm:flex-initial text-emerald-300 border-emerald-500/30 hover:border-emerald-500/50"
            startContent={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
          >
            AI Auto-Plan
          </Button>

          <Button
            variant="solid"
            size="sm"
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-initial"
            startContent={<Plus className="w-4 h-4" />}
          >
            Add Event
          </Button>
        </div>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-3xl bg-zinc-900/40 border border-zinc-800/80 border-dashed flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">
            No events scheduled for {selectedDate}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-5">
            Structure your workout, meals, focus blocks, and habits into a disciplined timeline.
          </p>

          <div className="flex items-center gap-2.5">
            <Button
              variant="bordered"
              size="sm"
              onClick={onOpenAIModal}
              className="text-emerald-300 border-emerald-500/30"
              startContent={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Generate with AI
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={onOpenAddModal}
              startContent={<Plus className="w-4 h-4" />}
            >
              Add Event
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative space-y-3 pt-1">
          {events.map((event, index) => {
            const isNowHere = isSelectedToday && index === nowIndex;
            return (
              <div key={event._id} className="relative">
                {/* Now Indicator Line if right before this event */}
                {isNowHere && (
                  <div className="flex items-center gap-2 my-2 py-1">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                    </span>
                    <span className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider">
                      Now ({currentTimeStr})
                    </span>
                    <div className="flex-1 border-t border-dashed border-rose-500/50" />
                  </div>
                )}

                <EventCard
                  event={event}
                  onToggleComplete={onToggleComplete}
                  onSelect={onSelectEvent}
                />
              </div>
            );
          })}

          {/* Now line at the very end if past all events */}
          {isSelectedToday && nowIndex >= events.length && (
            <div className="flex items-center gap-2 my-2 py-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <span className="text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider">
                Now ({currentTimeStr})
              </span>
              <div className="flex-1 border-t border-dashed border-rose-500/50" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
