"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ArrowRight,
  Check,
  Clock,
  Dumbbell,
  Utensils,
  Zap,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EventItem {
  _id: string;
  title: string;
  startTime: string;
  endTime?: string;
  category: string;
  color: string;
  isCompleted: boolean;
}

interface TodayPlanWidgetProps {
  initialEvents: EventItem[];
  todayStr: string;
}

export function TodayPlanWidget({ initialEvents, todayStr }: TodayPlanWidgetProps) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);

  const total = events.length;
  const completed = events.filter((e) => e.isCompleted).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleToggle = async (event: EventItem) => {
    const nextStatus = !event.isCompleted;
    setEvents((prev) =>
      prev.map((e) => (e._id === event._id ? { ...e, isCompleted: nextStatus } : e))
    );

    try {
      await fetch(`/api/planner/${event._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: nextStatus, targetDate: todayStr }),
      });
    } catch {
      // Revert on error
      setEvents((prev) =>
        prev.map((e) => (e._id === event._id ? { ...e, isCompleted: !nextStatus } : e))
      );
    }
  };

  return (
    <section className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 sm:p-6 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-100">Today&apos;s Schedule</h3>
              {total > 0 && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-emerald-400 border border-zinc-700">
                  {completed}/{total}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Time-blocked daily execution timeline
            </p>
          </div>
        </div>

        <Link href="/planner">
          <Button
            variant="ghost"
            size="sm"
            endContent={<ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />}
          >
            Full Planner
          </Button>
        </Link>
      </div>

      {/* Body */}
      {events.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <p className="text-xs text-zinc-400 mb-3">
            No events scheduled for today yet.
          </p>
          <Link href="/planner">
            <Button
              variant="flat"
              size="sm"
              startContent={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Plan Today with AI
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {events.slice(0, 4).map((event) => (
            <div
              key={event._id}
              style={{ borderInlineStartColor: event.color || "#10b981" }}
              className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 border-s-4 transition-all ${
                event.isCompleted ? "opacity-60" : "hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-mono font-medium text-zinc-400 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                  {event.startTime}
                </span>
                <span
                  className={`text-sm font-semibold text-zinc-200 truncate ${
                    event.isCompleted ? "line-through text-zinc-500" : ""
                  }`}
                >
                  {event.title}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(event)}
                className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  event.isCompleted
                    ? "bg-emerald-500 border-emerald-400 text-zinc-950 shadow-sm shadow-emerald-500/30"
                    : "border-zinc-700 bg-zinc-850 hover:border-emerald-500 text-transparent hover:text-emerald-400/50"
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-3" />
              </button>
            </div>
          ))}

          {events.length > 4 && (
            <div className="pt-1 text-center">
              <Link
                href="/planner"
                className="text-xs font-medium text-emerald-400 hover:underline"
              >
                +{events.length - 4} more events in Day Planner
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
