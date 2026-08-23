import React, { Suspense } from "react";
import { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { RecordWorkoutClient } from "@/components/workout/RecordWorkoutClient";

export const metadata: Metadata = {
  title: "Record Workout Stats — AI Fit Tracker",
  description: "Record your real weights, sets, reps, and RPE for your weekly routine session.",
};

export default function RecordWorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading workout logger...</span>
        </div>
      }
    >
      <RecordWorkoutClient />
    </Suspense>
  );
}
