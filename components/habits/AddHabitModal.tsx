"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import data from "@emoji-mart/data";
import { X, Sparkles, Palette, Loader2 } from "lucide-react";
import { IHabitData } from "./HabitCard";

// Dynamic import of emoji picker with SSR disabled
const EmojiPicker = dynamic(() => import("@emoji-mart/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8 text-zinc-500 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
      <span className="text-xs">Loading emoji picker...</span>
    </div>
  ),
});

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (habit: IHabitData) => void;
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

export function AddHabitModal({ isOpen, onClose, onCreated }: AddHabitModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⚡");
  const [color, setColor] = useState("#10b981");
  const [showEmojiDropdown, setShowEmojiDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emojiDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a habit name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emoji: emoji.trim() || "⚡",
          color: color.trim() || "#10b981",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create habit");
      }

      onCreated(data.habit);
      setName("");
      setEmoji("⚡");
      setColor("#10b981");
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-base text-white">Create New Habit</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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

                {/* Floating Dropdown */}
                {showEmojiDropdown && (
                  <div className="absolute top-full mt-2 inset-s-0 z-50 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <EmojiPicker
                      data={data}
                      theme="dark"
                      previewPosition="none"
                      skinTonePosition="none"
                      onEmojiSelect={(e: any) => {
                        setEmoji(e.native || "⚡");
                        setShowEmojiDropdown(false);
                      }}
                    />
                  </div>
                )}
              </div>

              <input
                type="text"
                required
                placeholder="e.g. Read 20 pages, Morning Run"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-4 py-3 rounded-2xl bg-zinc-800/50 border border-zinc-700/80 text-white placeholder-zinc-500 text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          {/* Habit Color (Supports HEX, RGB, HSL, or any CSS color) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Habit Accent Color</span>
              </label>
              <span className="text-[11px] font-mono text-zinc-400">{color}</span>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className="w-7 h-7 rounded-xl transition-transform hover:scale-110 focus:outline-hidden cursor-pointer"
                  style={{
                    backgroundColor: preset,
                    outline: color.toLowerCase() === preset.toLowerCase() ? "2px solid white" : "none",
                    outlineOffset: "2px",
                  }}
                  title={preset}
                />
              ))}
            </div>

            {/* Custom Color Input: native picker + text input */}
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={color.startsWith("#") && color.length === 7 ? color : "#10b981"}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-xl border border-zinc-700 bg-transparent cursor-pointer shrink-0"
              />
              <input
                type="text"
                placeholder="HEX, RGB, HSL e.g. #10b981 or rgb(16,185,129)"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/80 text-white font-mono text-xs placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Habit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
