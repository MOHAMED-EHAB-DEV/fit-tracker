"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Loader2, Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { HabitDTO } from "@/lib/habits/dto";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { errorMessage, requestJson, type HabitResponse } from "./api";

const UNDO_WINDOW_MS = 10_000;

interface UseHabitArchiveOptions {
  onArchived: (habit: HabitDTO) => void;
  onRestored: (habit: HabitDTO) => void;
}

/**
 * Archive flow shared by the habits page and the dashboard widget:
 * confirmation dialog -> archive -> "Undo" bar for 10 s. Restoring is also
 * available later from the "Archived habits" list.
 */
export function useHabitArchive({ onArchived, onRestored }: UseHabitArchiveOptions) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<HabitDTO | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [undoHabit, setUndoHabit] = useState<HabitDTO | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const undoTimer = useRef<number | null>(null);

  const callbacks = useRef({ onArchived, onRestored });
  useEffect(() => {
    callbacks.current = { onArchived, onRestored };
  });

  useEffect(() => () => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
  }, []);

  const requestArchive = useCallback((habit: HabitDTO) => setConfirming(habit), []);

  const closeConfirm = useCallback(() => {
    if (!archiving) setConfirming(null);
  }, [archiving]);

  const confirmArchive = useCallback(async () => {
    if (!confirming || archiving) return;
    setArchiving(true);
    try {
      const data = await requestJson<HabitResponse>(`/api/habits/${confirming._id}`, { method: "DELETE" });
      callbacks.current.onArchived(data.habit);
      markDashboardStale();
      setConfirming(null);
      setUndoHabit(data.habit);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndoHabit(null), UNDO_WINDOW_MS);
    } catch (err) {
      toast(errorMessage(err, "Could not archive the habit. Please try again."), "error");
    } finally {
      setArchiving(false);
    }
  }, [archiving, confirming, toast]);

  const restore = useCallback(
    async (habit: HabitDTO): Promise<boolean> => {
      if (restoringId) return false;
      setRestoringId(habit._id);
      try {
        const data = await requestJson<HabitResponse>(`/api/habits/${habit._id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
        callbacks.current.onRestored(data.habit);
        markDashboardStale();
        toast(`“${data.habit.name}” restored`, "success");
        return true;
      } catch (err) {
        toast(errorMessage(err, "Could not restore the habit. Please try again."), "error");
        return false;
      } finally {
        setRestoringId(null);
      }
    },
    [restoringId, toast]
  );

  const undo = useCallback(async () => {
    if (!undoHabit) return;
    const habit = undoHabit;
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    const restored = await restore(habit);
    if (restored) setUndoHabit(null);
  }, [restore, undoHabit]);

  const element = (
    <>
      <Modal
        isOpen={Boolean(confirming)}
        onClose={closeConfirm}
        size="sm"
        title="Archive habit?"
        footer={
          <>
            <button
              type="button"
              onClick={closeConfirm}
              disabled={archiving}
              className="min-h-11 px-4 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmArchive}
              disabled={archiving}
              aria-busy={archiving}
              className="min-h-11 px-4 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {archiving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Archive className="w-4 h-4" aria-hidden="true" />}
              <span>Archive</span>
            </button>
          </>
        }
      >
        {confirming && (
          <p className="text-sm text-zinc-300 leading-relaxed">
            <span className="font-bold text-white">
              {confirming.emoji} {confirming.name}
            </span>{" "}
            will be removed from your daily list. Its history is kept and you can restore it any time
            from <span className="font-semibold text-white">Archived habits</span> on the Habits page.
          </p>
        )}
      </Modal>

      {undoHabit && (
        <div
          role="status"
          className="fixed z-50 inset-x-4 bottom-24 sm:bottom-6 sm:inset-x-auto sm:inset-e-6 sm:w-96 flex items-center justify-between gap-3 p-3 ps-4 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl"
        >
          <span className="text-sm text-zinc-200 min-w-0 truncate">
            Archived “{undoHabit.name}”
          </span>
          <button
            type="button"
            onClick={undo}
            disabled={restoringId === undoHabit._id}
            className="min-h-11 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-bold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
          >
            {restoringId === undoHabit._id ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Undo2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Undo</span>
          </button>
        </div>
      )}
    </>
  );

  return { requestArchive, restore, restoringId, element };
}
