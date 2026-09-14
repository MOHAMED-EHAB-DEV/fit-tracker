"use client";

import { useState } from "react";
import {
  Sparkles,
  Check,
  AlertCircle,
  Layers,
} from "lucide-react";
import { EventCategory, CATEGORY_CONFIG, HabitOption } from "./types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface AIGeneratedEvent {
  title: string;
  description: string;
  startTime: string;
  endTime?: string;
  category: EventCategory;
  color: string;
  linkedHabitIds?: string[];
}

interface AIPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string;
  availableHabits: HabitOption[];
  onApplySchedule: (events: AIGeneratedEvent[], replaceExisting: boolean) => Promise<void>;
}

export default function AIPlannerModal({
  isOpen,
  onClose,
  targetDate,
  onApplySchedule,
}: AIPlannerModalProps) {
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [generatedEvents, setGeneratedEvents] = useState<AIGeneratedEvent[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate, notes }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to generate schedule");
      }

      setSummary(data.summary);
      const events: AIGeneratedEvent[] = data.events || [];
      setGeneratedEvents(events);
      setSelectedIndices(events.map((_, idx) => idx));
    } catch (err: any) {
      setError(err.message || "An error occurred while generating your plan.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEventSelection = (idx: number) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleApply = async () => {
    const eventsToApply = generatedEvents.filter((_, idx) => selectedIndices.includes(idx));
    if (eventsToApply.length === 0) return;

    setIsApplying(true);
    try {
      await onApplySchedule(eventsToApply, replaceExisting);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to apply schedule");
    } finally {
      setIsApplying(false);
    }
  };

  const modalFooter = generatedEvents.length > 0 ? (
    <div className="flex items-center justify-between w-full">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleGenerate}
        disabled={isLoading || isApplying}
      >
        Regenerate
      </Button>

      <Button
        variant="solid"
        size="sm"
        isLoading={isApplying}
        disabled={selectedIndices.length === 0}
        onClick={handleApply}
        startContent={<Layers className="w-4 h-4" />}
      >
        Apply ({selectedIndices.length}) Events
      </Button>
    </div>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span>AI Day Architect</span>
        </div>
      }
      description={`Generate optimal schedule for ${targetDate}`}
      footer={modalFooter}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Special Focus & Instructions (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Leg day workout in afternoon, team call at 3 PM, wind down by 10 PM..."
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm resize-none"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {generatedEvents.length === 0 && (
          <Button
            variant="solid"
            size="lg"
            isLoading={isLoading}
            onClick={handleGenerate}
            className="w-full"
            startContent={<Sparkles className="w-4 h-4" />}
          >
            Generate Day Schedule
          </Button>
        )}

        {isLoading && (
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col items-center justify-center gap-3 animate-pulse">
            <Sparkles className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-medium text-zinc-200">
              Architecting your day with habits, nutrition & workouts...
            </p>
            <p className="text-xs text-zinc-400">Powered by Gemini AI</p>
          </div>
        )}

        {generatedEvents.length > 0 && !isLoading && (
          <div className="space-y-4">
            {summary && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed">
                <span className="font-semibold block mb-0.5">Strategy Summary:</span>
                {summary}
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pe-1">
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>Generated Blocks ({selectedIndices.length}/{generatedEvents.length} selected)</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIndices(
                      selectedIndices.length === generatedEvents.length
                        ? []
                        : generatedEvents.map((_, i) => i)
                    )
                  }
                  className="text-emerald-400 hover:underline"
                >
                  {selectedIndices.length === generatedEvents.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {generatedEvents.map((evt, idx) => {
                const isSelected = selectedIndices.includes(idx);
                const cfg = CATEGORY_CONFIG[evt.category] || CATEGORY_CONFIG.other;
                return (
                  <div
                    key={idx}
                    onClick={() => toggleEventSelection(idx)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-700"
                        : "bg-zinc-950/60 border-zinc-800/60 opacity-50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                        isSelected
                          ? "bg-emerald-500 border-emerald-400 text-zinc-950"
                          : "border-zinc-700 bg-zinc-800"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-3" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-zinc-300">
                          {evt.startTime} {evt.endTime && `→ ${evt.endTime}`}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${cfg.badgeBg} ${cfg.badgeText}`}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-zinc-100 truncate mt-0.5">
                        {evt.title}
                      </h4>
                      {evt.description && (
                        <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 px-1 text-xs text-zinc-300">
              <input
                type="checkbox"
                id="replaceExisting"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0"
              />
              <label htmlFor="replaceExisting" className="cursor-pointer">
                Replace existing events scheduled for {targetDate}
              </label>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
