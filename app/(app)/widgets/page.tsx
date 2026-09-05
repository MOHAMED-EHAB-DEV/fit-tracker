import React from "react";
import { Metadata } from "next";
import { WidgetGalleryClient } from "@/components/widgets/WidgetGalleryClient";

export const metadata: Metadata = {
  title: "Home Screen Widgets — AI Fit Tracker",
  description: "Preview and add live native Android home screen widgets for steps, workouts, nutrition, and streaks.",
};

export default function WidgetsPage() {
  return <WidgetGalleryClient />;
}
