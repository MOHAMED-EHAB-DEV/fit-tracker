"use client";

import { useState } from "react";
import { Plus, CheckCircle2, Circle, Repeat, Info } from "lucide-react";
import { HabitOption, EventCategory, RecurrenceType, CATEGORY_CONFIG } from "./types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (eventData: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    category: EventCategory;
    color: string;
    recurrence: RecurrenceType;
    linkedHabitIds: string[];
  }) => Promise<void>;
  availableHabits: HabitOption[];
  targetDate: string;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function AddEventModal({
  isOpen,
  onClose,
  onAddEvent,
  availableHabits,
  targetDate,
}: AddEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("workout");
  const [color, setColor] = useState("#10b981");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("once");
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCategoryChange = (newCat: EventCategory) => {
    setCategory(newCat);
    setColor(CATEGORY_CONFIG[newCat].defaultColor);
  };

  const handleRecurrenceChange = (newRecurrence: RecurrenceType) => {
    setRecurrence(newRecurrence);
  };

  const handleToggleHabit = (habitId: string) => {
    setSelectedHabitIds((prev) =>
      prev.includes(habitId) ? prev.filter((id) => id !== habitId) : [...prev, habitId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddEvent({
        title: title.trim(),
        description: description.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        category,
        color,
        recurrence,
        linkedHabitIds: selectedHabitIds,
      });
      setTitle("");
      setDescription("");
      setStartTime("09:00");
      setEndTime("");
      setCategory("workout");
      setRecurrence("once");
      setSelectedHabitIds([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalFooter = (
    <div className="flex items-center justify-end gap-2 w-full">
      <Button variant="ghost" size="sm" onClick={onClose}>
        Cancel
      </Button>
      <Button
        variant="solid"
        size="sm"
        isLoading={isSubmitting}
        onClick={handleSubmit}
        startContent={<Plus className="w-4 h-4" />}
      >
        Add Event
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Event"
      description={`Planning for ${targetDate}`}
      footer={modalFooter}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Event Title *
          </label>
          <Input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Upper Body Push Session"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Category
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center ${
                    isSelected
                      ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.borderCol} ring-1 ring-emerald-500/50`
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recurrence Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-emerald-400" />
              Recurrence
            </label>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {RECURRENCE_OPTIONS.map((opt) => {
              const isSelected = recurrence === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleRecurrenceChange(opt.value)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30 shadow-sm"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {selectedHabitIds.length > 0 ? (
            <p className="flex items-center gap-1 text-[11px] text-emerald-400/90 mt-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Connected to {selectedHabitIds.length} habit{selectedHabitIds.length > 1 ? "s" : ""} — completion auto-syncs Daily Log.
            </p>
          ) : recurrence !== "once" ? (
            <p className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              Repeating {recurrence}.
            </p>
          ) : null}
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Start Time *
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              End Time (optional)
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            Description / Targets
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm resize-none"
            placeholder="Optional notes or details..."
          />
        </div>

        {/* Habits Checklist */}
        {availableHabits.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Connect Habits
              </label>
              <span className="text-[11px] text-zinc-500">
                Marking event completed auto-completes habits
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
              {availableHabits.map((h) => {
                const isLinked = selectedHabitIds.includes(h._id);
                return (
                  <button
                    key={h._id}
                    type="button"
                    onClick={() => handleToggleHabit(h._id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs border text-start transition-colors ${
                      isLinked
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span className="truncate">
                      {h.emoji} {h.name}
                    </span>
                    {isLinked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ms-1" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0 ms-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
