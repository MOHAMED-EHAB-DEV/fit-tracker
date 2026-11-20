import { Suspense } from "react";
import type { Metadata } from "next";
import { PhotoAnalyzer } from "@/components/nutrition/PhotoAnalyzer";
import NutritionAnalyzeLoading from "./loading";

export const metadata: Metadata = {
  title: "AI meal estimate",
  description: "Estimate a meal's calories and macros from photos, then review before saving.",
};

export default function AnalyzeMealPage() {
  // PhotoAnalyzer reads ?date= and ?from= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<NutritionAnalyzeLoading />}>
      <PhotoAnalyzer />
    </Suspense>
  );
}
