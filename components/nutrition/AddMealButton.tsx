"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { MealFormDialog } from "@/components/nutrition/MealFormDialog";
import { todayInZone, useUserTimeZone } from "@/components/nutrition/useUserTimeZone";
import { newMealDraft, validateDraft, type MealDraft } from "@/lib/nutrition/draft";
import { createMealRequest } from "@/lib/nutrition/client";
import { formatDateString } from "@/lib/time";
import { cn } from "@/lib/utils";

interface AddMealButtonProps {
  /** The day being viewed; the new meal defaults to it. */
  dateString: string;
  className?: string;
}

/** Manual meal entry (no AI) for any day up to today. */
export function AddMealButton({ dateString, className }: AddMealButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const tz = useUserTimeZone();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<MealDraft | null>(null);
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [today, setToday] = useState(dateString);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const openDialog = () => {
    const now = todayInZone(tz);
    const fresh = newMealDraft(dateString > now ? now : dateString, tz);
    setToday(now);
    setInitial(fresh);
    setDraft(fresh);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!draft || savingRef.current) return;
    const now = todayInZone(tz);
    const checked = validateDraft(draft, now);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await createMealRequest(checked.payload);
      setOpen(false);
      toast(
        checked.payload.dateString === dateString
          ? "Meal added"
          : `Meal added to ${formatDateString(checked.payload.dateString)}`,
        "success"
      );
      if (checked.payload.dateString !== dateString) {
        router.push(checked.payload.dateString === now ? "/nutrition" : `/nutrition?date=${checked.payload.dateString}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The meal could not be saved. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={cn(
          "inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-100 font-semibold text-sm transition active:scale-95 cursor-pointer",
          className
        )}
      >
        <PencilLine className="w-4 h-4 text-emerald-300" aria-hidden="true" />
        <span>Add meal</span>
      </button>

      {open && draft && initial && (
        <MealFormDialog
          isOpen={open}
          idPrefix="add-meal"
          title="Add a meal"
          description="Enter what you ate. No AI needed."
          initialDraft={initial}
          draft={draft}
          onChange={setDraft}
          maxDate={today}
          error={error}
          submitLabel="Save meal"
          isSaving={saving}
          onSubmit={save}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default AddMealButton;
