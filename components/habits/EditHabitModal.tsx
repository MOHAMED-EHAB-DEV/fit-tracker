"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";
import { X, Sparkles, Palette, Loader2, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { IHabitData } from "./HabitCard";

const EmojiPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8 text-zinc-500 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      <span className="text-xs">Loading emoji picker...</span>
    </div>
  ),
});

interface EditHabitModalProps {
  isOpen: boolean;
  habit: IHabitData | null;
  onClose: () => void;
  onUpdated: (habit: IHabitData) => void;
  onDeleted: (habitId: string) => void;
}

const COLOR_PRESETS = [
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#ef4444", // red
  "#14b8a6", // teal
];

export function EditHabitModal({
  isOpen,
  habit,
  onClose,
  onUpdated,
  onDeleted,
}: EditHabitModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⚡");
  const [color, setColor] = useState("#10b981");
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emojiDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (habit) {
      setName(habit.name || "");
      setEmoji(habit.emoji || "⚡");
      setColor(habit.color || "#10b981");
      setError(null);
      setConfirmDelete(false);
      setShowEmojiDropdown(false);
    }
  }, [habit]);

  // Close emoji dropdown on outside click or Escape
  useEffect(() => {
    if (!showEmojiDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiDropdownRef.current &&
        !emojiDropdownRef.current.contains(e.target as Node)
      ) {
        setShowEmojiDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEmojiDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEmojiDropdown]);

  if (!isOpen || !habit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a habit name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/habits/${habit._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emoji: emoji.trim() || "⚡",
          color: color.trim() || "#10b981",
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to update habit");
      }

      onUpdated(resData.habit);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/habits/${habit._id}`, {
        method: "DELETE",
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to delete habit");
      }

      onDeleted(habit._id);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-zinc-950/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}22`, color }}
            >
              <Pencil className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-white">Edit Habit</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDelete}
              title={confirmDelete ? "Confirm delete" : "Delete habit"}
              aria-label="Delete habit"
              disabled={deleting || loading}
              className={cn(
                "p-1.5 rounded-xl transition cursor-pointer",
                confirmDelete
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
              )}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Habit Name & Emoji Trigger */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Habit Name & Emoji
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0" ref={emojiDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiDropdown((prev) => !prev)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 transition cursor-pointer"
                  style={{
                    boxShadow: `0 0 12px -2px ${color}33`,
                  }}
                  title="Select emoji icon"
                  aria-expanded={showEmojiDropdown}
                  aria-haspopup="dialog"
                >
                  {emoji}
                </button>

                {/* Floating Anchored Dropdown */}
                {showEmojiDropdown && (
                  <div className="absolute inset-s-0 top-full mt-2 z-50 shadow-2xl rounded-2xl border border-zinc-700 bg-zinc-900 overflow-hidden">
                    <EmojiPicker
                      data={data}
                      onEmojiSelect={(e: any) => {
                        if (e?.native) {
                          setEmoji(e.native);
                        }
                        setShowEmojiDropdown(false);
                      }}
                      theme="dark"
                      previewPosition="none"
                      skinTonePosition="none"
                      searchPosition="top"
                      maxFrequentRows={1}
                    />
                  </div>
                )}
              </div>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Morning Meditation"
                className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 transition"
                maxLength={40}
                autoFocus
              />
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Accent Color
              </label>
              <span className="text-[11px] font-mono text-zinc-400 uppercase">
                {color}
              </span>
            </div>

            {/* Preset Color Swatches */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={cn(
                    "w-8 h-8 rounded-xl transition-transform cursor-pointer flex items-center justify-center relative",
                    color.toLowerCase() === preset.toLowerCase()
                      ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                      : "hover:scale-105 opacity-80 hover:opacity-100"
                  )}
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
            </div>

            {/* Native Color Picker & Hex Text Input */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden cursor-pointer shrink-0">
                <Palette className="w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="color"
                  value={color.startsWith("#") ? color : "#10b981"}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  title="Pick custom color"
                />
              </div>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#10b981 or rgb/hsl"
                className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Habit Live Preview */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Preview
            </label>
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl border bg-zinc-800/40"
              style={{
                borderColor: `${color}44`,
                boxShadow: `0 0 16px -4px ${color}22`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{
                    backgroundColor: `${color}18`,
                    border: `1px solid ${color}33`,
                  }}
                >
                  <span>{emoji || "⚡"}</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-100">
                    {name || "Habit name"}
                  </h4>
                  <span
                    className="text-[10px] font-medium flex items-center gap-1.5"
                    style={{ color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: color }}
                    />
                    Daily habit
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Delete on left, Cancel & Save on right */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || loading}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer order-2 sm:order-1",
                confirmDelete
                  ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                  : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
              )}
              title="Delete habit"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>
                {confirmDelete ? "Confirm Delete?" : "Delete Habit"}
              </span>
            </button>

            <div className="flex items-center justify-end gap-2 order-1 sm:order-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || deleting || !name.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 text-xs font-black transition cursor-pointer shadow-md shadow-emerald-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
