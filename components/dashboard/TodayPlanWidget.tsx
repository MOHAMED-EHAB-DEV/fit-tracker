"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ArrowRight, Check, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/context/UserContext";
import { localDateString } from "@/lib/time";
import { readApiResponse } from "@/lib/assistant/http";
import { syncPlannerReminders } from "@/services/planner-reminders";

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

const linkButtonClass =
  "inline-flex items-center justify-center gap-1.5 px-3 min-h-11 rounded-xl text-sm font-semibold transition-colors";

export function TodayPlanWidget({ initialEvents, todayStr }: TodayPlanWidgetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const timeZone = user?.preferences?.timezone;

  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [sourceEvents, setSourceEvents] = useState(initialEvents);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const pendingRef = useRef(new Set<string>());

  // Fresh server data (router.refresh) replaces the local copy.
  if (sourceEvents !== initialEvents) {
    setSourceEvents(initialEvents);
    setEvents(initialEvents);
  }

  // A dashboard left open past midnight reloads to show the new day.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (localDateString(new Date(), timeZone) !== todayStr) router.refresh();
    };
    const interval = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, timeZone, todayStr]);

  const total = events.length;
  const completed = events.filter((e) => e.isCompleted).length;

  const setPending = (id: string, on: boolean) => {
    if (on) pendingRef.current.add(id);
    else pendingRef.current.delete(id);
    setPendingIds(new Set(pendingRef.current));
  };

  const handleToggle = async (event: EventItem) => {
    if (pendingRef.current.has(event._id)) return;
    const next = !event.isCompleted;
    setPending(event._id, true);
    setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, isCompleted: next } : e)));

    let error: string | null = null;
    try {
      const res = await fetch(`/api/planner/${event._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: next, targetDate: todayStr }),
      });
      const result = await readApiResponse<{ event: { isCompleted: boolean } }>(res);
      if (!result.ok) error = result.error;
    } catch {
      error = "Could not reach the server. Your change was not saved.";
    }

    setPending(event._id, false);
    if (error) {
      setEvents((prev) => prev.map((e) => (e._id === event._id ? { ...e, isCompleted: !next } : e)));
      toast(error, "error");
      return;
    }
    syncPlannerReminders().catch(() => undefined);
    // Linked habits may have changed: refresh the dashboard's habit list.
    router.refresh();
  };

  return (
    <section
      aria-labelledby="today-plan-heading"
      className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 sm:p-6 backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CalendarClock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 id="today-plan-heading" className="text-base font-bold text-zinc-100">
                Today&apos;s Schedule
              </h3>
              {total > 0 && (
                <span
                  className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-emerald-400 border border-zinc-700"
                  aria-label={`${completed} of ${total} done`}
                >
                  {completed}/{total}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Your time-blocked plan for today</p>
          </div>
        </div>

        <Link href="/planner" className={`${linkButtonClass} text-zinc-300 hover:text-white hover:bg-white/10 shrink-0`}>
          Planner
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <p className="text-sm text-zinc-400 mb-3">Nothing scheduled for today yet.</p>
          <Link href="/planner" className={`${linkButtonClass} bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/20`}>
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Plan today
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {events.slice(0, 4).map((event) => {
            const isPending = pendingIds.has(event._id);
            return (
              <li
                key={event._id}
                style={{ borderInlineStartColor: event.color || "#10b981" }}
                className={`flex items-center justify-between gap-3 ps-3 pe-1.5 py-1.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 border-s-4 ${
                  event.isCompleted ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xs font-mono font-medium text-zinc-400 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
                    {event.startTime}
                  </span>
                  <span
                    className={`text-sm font-semibold truncate ${
                      event.isCompleted ? "line-through text-zinc-400" : "text-zinc-200"
                    }`}
                  >
                    {event.title}
                  </span>
                </div>

                <button
                  type="button"
                  role="checkbox"
                  aria-checked={event.isCompleted}
                  aria-label={`Done: ${event.title}`}
                  aria-busy={isPending}
                  disabled={isPending}
                  onClick={() => handleToggle(event)}
                  className={`w-11 h-11 rounded-full border-2 flex items-center justify-center shrink-0 transition-all disabled:cursor-wait ${
                    event.isCompleted
                      ? "bg-emerald-500 border-emerald-400 text-zinc-950"
                      : "border-zinc-600 bg-zinc-900 text-zinc-500 hover:border-emerald-500"
                  }`}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className={`w-4 h-4 stroke-3 ${event.isCompleted ? "" : "opacity-30"}`} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {events.length > 4 && (
        <div className="pt-3 text-center">
          <Link href="/planner" className="inline-flex items-center min-h-11 px-2 text-sm font-medium text-emerald-400 hover:underline">
            +{events.length - 4} more in the Day Planner
          </Link>
        </div>
      )}
    </section>
  );
}
