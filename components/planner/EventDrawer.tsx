"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  Bell,
  Save,
  Calendar,
  Repeat,
  Info,
} from "lucide-react";
import { PlannedEventItem, HabitOption, EventCategory, RecurrenceType, CATEGORY_CONFIG } from "./types";
import { triggerSystemNotification } from "@/services/webview-bridge";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface EventDrawerProps {
  event: PlannedEventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<PlannedEventItem>) => Promise<void>;
  onDelete: (id: string, mode?: "this" | "all") => Promise<void>;
  onToggleComplete: (event: PlannedEventItem) => Promise<void>;
  availableHabits: HabitOption[];
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function EventDrawer({
  event,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onToggleComplete,
  availableHabits,
}: EventDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("other");
  const [color, setColor] = useState("#10b981");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("once");
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);

  // Sync state when event changes
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || "");
      setStartTime(event.startTime);
      setEndTime(event.endTime || "");
      setCategory(event.category || "other");
      setColor(event.color || "#10b981");
      setRecurrence(event.recurrence || "once");
      setSelectedHabitIds(
        (event.linkedHabitIds || []).map((h: any) =>
          typeof h === "string" ? h : String(h._id || h)
        )
      );
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [event]);

  if (!event) return null;

  const currentConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;

  const handleRecurrenceChange = (newRecurrence: RecurrenceType) => {
    setRecurrence(newRecurrence);
  };

  const handleToggleHabitLink = (habitId: string) => {
    setSelectedHabitIds((prev) => {
      const habitIdStr = String(habitId);
      const exists = prev.some((id) => String(id) === habitIdStr);
      return exists
        ? prev.filter((id) => String(id) !== habitIdStr)
        : [...prev, habitIdStr];
    });
  };

  const handleSaveEdit = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(event._id, {
        title: title.trim(),
        description: description.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        category,
        color,
        recurrence,
        linkedHabitIds: selectedHabitIds as any,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOccurrence = async () => {
    setIsDeleting(true);
    try {
      await onDelete(event._id, "this");
      onClose();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await onDelete(event._id, "all");
      onClose();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSendNotification = () => {
    triggerSystemNotification({
      id: event._id,
      title: event.title,
      description: event.description || `Event scheduled at ${event.startTime}`,
      category: event.category,
    });
  };

  const isRecurringEvent = event.recurrence && event.recurrence !== "once";

  const drawerTitle = (
    <div className="flex items-center gap-2">
      <span
        className={`px-2.5 py-0.5 text-xs font-semibold rounded-lg border ${currentConfig.badgeBg} ${currentConfig.badgeText} ${currentConfig.borderCol}`}
      >
        {currentConfig.label}
      </span>
      {isRecurringEvent && (
        <span className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
          <Repeat className="w-3.5 h-3.5" />
          {event.recurrence}
        </span>
      )}
      {event.isCompleted && (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </span>
      )}
    </div>
  );

  const drawerFooter = isEditing ? (
    <div className="w-full flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={isSaving}
        onClick={() => {
          if (event) {
            setTitle(event.title);
            setDescription(event.description || "");
            setStartTime(event.startTime);
            setEndTime(event.endTime || "");
            setCategory(event.category || "other");
            setColor(event.color || "#10b981");
            setRecurrence(event.recurrence || "once");
            setSelectedHabitIds(
              (event.linkedHabitIds || []).map((h: any) =>
                typeof h === "string" ? h : String(h?._id || h)
              )
            );
          }
          setIsEditing(false);
          setShowDeleteConfirm(false);
        }}
      >
        Cancel
      </Button>

      <Button
        variant="solid"
        size="sm"
        isLoading={isSaving}
        onClick={handleSaveEdit}
        startContent={<Save className="w-4 h-4" />}
      >
        Save Changes
      </Button>
    </div>
  ) : (
    <div className="w-full flex items-center justify-between">
      <Button
        variant="ghost"
        size="sm"
        disabled={isDeleting}
        onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
        startContent={<Trash2 className="w-4 h-4" />}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>

      <Button
        variant="bordered"
        size="sm"
        onClick={() => {
          setIsEditing(true);
          setShowDeleteConfirm(false);
        }}
        startContent={<Edit3 className="w-3.5 h-3.5" />}
      >
        Edit Event
      </Button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="left"
      title={drawerTitle}
      footer={drawerFooter}
      className="w-full sm:max-w-md bg-zinc-950/98"
    >
      <div className="space-y-6">
        {/* Delete Confirmation Options */}
        {showDeleteConfirm && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-3 animate-in fade-in-50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Delete Options
            </h4>
            <p className="text-xs text-zinc-300">
              {isRecurringEvent
                ? "This is a repeating event. Choose which instances to remove:"
                : "Are you sure you want to permanently delete this event?"}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {isRecurringEvent && (
                <Button
                  variant="bordered"
                  size="sm"
                  disabled={isDeleting}
                  onClick={handleDeleteOccurrence}
                  className="text-xs border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                >
                  Only This Day
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteAll}
                className="text-xs"
              >
                {isRecurringEvent ? "All Occurrences" : "Confirm Delete"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Event Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Heavy Leg Day Workout"
              />
            </div>

            {/* Recurrence Selector in Edit Mode */}
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
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  End Time
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
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as EventCategory;
                  setCategory(cat);
                  setColor(CATEGORY_CONFIG[cat].defaultColor);
                }}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value="workout">🏋️ Workout</option>
                <option value="nutrition">🥗 Nutrition</option>
                <option value="habit">⚡ Habit</option>
                <option value="recovery">🧘 Recovery</option>
                <option value="focus">🎯 Deep Focus</option>
                <option value="other">⏰ Other / General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Description & Notes
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 text-sm resize-none"
                placeholder="Details, targets, or instructions..."
              />
            </div>

            {/* Habit Linking */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Connected Habits
                </label>
                <span className="text-[11px] text-zinc-500">
                  Syncs Daily Log
                </span>
              </div>

              {availableHabits.length === 0 ? (
                <p className="text-xs text-zinc-500">No active habits found.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {availableHabits.map((habit) => {
                    const habitIdStr = String(habit._id);
                    const isLinked = selectedHabitIds.some(
                      (id) => String(id) === habitIdStr
                    );
                    return (
                      <button
                        key={habitIdStr}
                        type="button"
                        onClick={() => handleToggleHabitLink(habitIdStr)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm border transition-colors ${
                          isLinked
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{habit.emoji}</span>
                          <span>{habit.name}</span>
                        </div>
                        {isLinked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="solid"
                isLoading={isSaving}
                onClick={handleSaveEdit}
                className="flex-1"
                startContent={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="space-y-6">
            <div>
              <h3
                className={`text-xl font-bold text-zinc-100 ${
                  event.isCompleted ? "line-through text-zinc-400" : ""
                }`}
              >
                {event.title}
              </h3>

              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-400">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 font-mono">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{event.startTime}</span>
                  {event.endTime && <span>→ {event.endTime}</span>}
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{event.date}</span>
                </div>

                {isRecurringEvent && (
                  <div className="flex items-center gap-1 text-blue-400 font-medium">
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Repeats {event.recurrence}</span>
                  </div>
                )}
              </div>
            </div>

            {event.description && (
              <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              </div>
            )}

            {/* Linked Habits */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Connected Habits
                </span>
                <span className="text-[11px] text-zinc-500">
                  Syncs Daily Log
                </span>
              </div>

              {event.linkedHabitIds && event.linkedHabitIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {event.linkedHabitIds.map((h: any) => {
                    const habitIdStr = String(
                      typeof h === "object" && h !== null ? h._id || "" : h
                    );
                    const habitObj =
                      typeof h === "object" && h !== null && h.name
                        ? h
                        : availableHabits.find((ah) => String(ah._id) === habitIdStr);
                    const name = habitObj?.name || "Habit";
                    const emoji = habitObj?.emoji || "⚡";
                    const key = habitIdStr || String(h);

                    return (
                      <div
                        key={key}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200"
                      >
                        <span className="text-sm">{emoji}</span>
                        <span>{name}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  No habits connected to this event.
                </p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-3">
              <Button
                variant={event.isCompleted ? "bordered" : "solid"}
                size="lg"
                onClick={() => onToggleComplete(event)}
                className="w-full"
                startContent={<CheckCircle2 className="w-4 h-4" />}
              >
                {event.isCompleted ? "Mark as Incomplete" : "Mark as Completed"}
              </Button>

              <Button
                variant="flat"
                size="md"
                onClick={handleSendNotification}
                className="w-full"
                startContent={<Bell className="w-4 h-4" />}
              >
                Show Notification Banner
              </Button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
