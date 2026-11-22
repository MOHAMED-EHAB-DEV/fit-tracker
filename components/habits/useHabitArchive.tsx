"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { HabitDTO } from "@/lib/habits/dto";
import { markDashboardStale } from "@/lib/dashboard/stale";
import { errorMessage, requestJson, type HabitResponse } from "./api";

interface UseHabitArchiveOptions {
  onArchived: (habit: HabitDTO) => void;
  onRestored: (habit: HabitDTO) => void;
}

/**
 * Archiving is reversible, so it happens at once and the toast offers Undo
 * (no confirmation, no danger button). Restoring is also available later
 * from "Archived habits".
 */
export function useHabitArchive({ onArchived, onRestored }: UseHabitArchiveOptions) {
  const { toast } = useToast();
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const callbacks = useRef({ onArchived, onRestored });
  useEffect(() => {
    callbacks.current = { onArchived, onRestored };
  });

  const restore = useCallback(
    async (habit: HabitDTO, options: { quiet?: boolean } = {}): Promise<boolean> => {
      setRestoringId(habit._id);
      try {
        const data = await requestJson<HabitResponse>(`/api/habits/${habit._id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: true }),
        });
        callbacks.current.onRestored(data.habit);
        markDashboardStale();
        if (!options.quiet) toast(`“${data.habit.name}” restored`, "success");
        return true;
      } catch (err) {
        toast(errorMessage(err, "Could not restore the habit. Please try again."), "error");
        return false;
      } finally {
        setRestoringId(null);
      }
    },
    [toast]
  );

  const archive = useCallback(
    async (habit: HabitDTO) => {
      if (archivingId) return;
      setArchivingId(habit._id);
      try {
        const data = await requestJson<HabitResponse>(`/api/habits/${habit._id}`, { method: "DELETE" });
        callbacks.current.onArchived(data.habit);
        markDashboardStale();
        toast(`“${data.habit.name}” archived`, "info", {
          action: { label: "Undo", onClick: () => void restore(data.habit, { quiet: true }) },
        });
      } catch (err) {
        toast(errorMessage(err, "Could not archive the habit. Please try again."), "error");
      } finally {
        setArchivingId(null);
      }
    },
    [archivingId, restore, toast]
  );

  return { archive, restore, archivingId, restoringId };
}
