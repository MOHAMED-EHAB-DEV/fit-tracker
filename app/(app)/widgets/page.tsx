import React from "react";
import { Metadata } from "next";
import { WidgetGalleryClient } from "@/components/widgets/WidgetGalleryClient";

export const metadata: Metadata = {
  title: "Home screen widgets",
  description: "Android home screen widgets for steps, calories, water and your habit streak.",
};

export default function WidgetsPage() {
  return <WidgetGalleryClient />;
}
