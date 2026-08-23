import { PhotoAnalyzer } from "@/components/nutrition/PhotoAnalyzer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analyze Meal — AI Fit Tracker",
  description: "Snap or upload a meal photo to calculate calories and macros with Gemini AI.",
};

export default function AnalyzeMealPage() {
  return (
    <div className="space-y-6">
      <PhotoAnalyzer />
    </div>
  );
}
