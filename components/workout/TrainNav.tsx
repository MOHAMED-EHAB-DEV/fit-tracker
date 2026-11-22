import React from "react";
import { SegmentedNav } from "@/components/ui/SegmentedControl";

export type TrainSection = "workouts" | "history" | "exercises";

const SECTIONS: ReadonlyArray<{ id: TrainSection; href: string; label: string }> = [
  { id: "workouts", href: "/workouts", label: "Workouts" },
  { id: "history", href: "/workouts/history", label: "History" },
  { id: "exercises", href: "/workouts/exercises", label: "Exercises" },
];

/** Train's three sections: Workouts | History | Exercises (each its own page). */
export function TrainNav({ current }: { current: TrainSection }) {
  return (
    <SegmentedNav
      label="Train sections"
      className="w-full grid-cols-3 md:max-w-[420px]"
      items={SECTIONS.map((section) => ({ href: section.href, label: section.label, active: section.id === current }))}
    />
  );
}

export default TrainNav;
