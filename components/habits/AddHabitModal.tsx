"use client";

import React from "react";
import type { HabitDTO } from "@/lib/habits/dto";
import { HabitFormModal } from "./HabitFormModal";

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (habit: HabitDTO) => void;
}

export function AddHabitModal({ isOpen, onClose, onCreated }: AddHabitModalProps) {
  return <HabitFormModal isOpen={isOpen} habit={null} onClose={onClose} onSaved={onCreated} />;
}
