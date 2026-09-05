import React, { Suspense } from "react";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { NewWorkoutClient } from "@/components/workout/NewWorkoutClient";

export const metadata: Metadata = {
  title: "Create Workout Sheet — AI Fit Tracker",
  description: "Assign a workout to a day of the week and start tracking your lifts and progression.",
};

export default function NewWorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading workout setup...</span>
        </div>
      }
    >
      <NewWorkoutClient />
    </Suspense>
  );
}
