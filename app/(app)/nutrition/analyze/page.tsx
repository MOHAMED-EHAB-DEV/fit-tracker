import React, { Suspense } from "react";
import { PhotoAnalyzer } from "@/components/nutrition/PhotoAnalyzer";
import { Loader2 } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analyze Meal — AI Fit Tracker",
  description: "Snap or upload a meal photo to calculate calories and macros with Gemini AI.",
};

export default function AnalyzeMealPage() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[40vh] text-zinc-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Loading food analyzer...</span>
          </div>
        }
      >
        <PhotoAnalyzer />
      </Suspense>
    </div>
  );
}

