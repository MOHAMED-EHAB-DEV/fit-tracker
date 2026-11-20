"use client";

import React from "react";
import type { HabitDTO } from "@/lib/habits/dto";
import { HabitFormModal } from "./HabitFormModal";

interface EditHabitModalProps {
  isOpen: boolean;
  habit: HabitDTO | null;
  onClose: () => void;
  onUpdated: (habit: HabitDTO) => void;
  /** Opens the archive confirmation (owned by the parent, see useHabitArchive). */
  onRequestArchive: (habit: HabitDTO) => void;
}

export function EditHabitModal({ isOpen, habit, onClose, onUpdated, onRequestArchive }: EditHabitModalProps) {
  return (
    <HabitFormModal
      isOpen={isOpen && Boolean(habit)}
      habit={habit}
      onClose={onClose}
      onSaved={onUpdated}
      onRequestArchive={onRequestArchive}
    />
  );
}
