import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiKitClient } from "@/components/ui/UiKitClient";

export const metadata: Metadata = { title: "UI kit" };

/**
 * Development-only gallery of the design-system primitives (components/ui),
 * for reviewing the redesign before every screen uses them. Not available in
 * production builds.
 */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKitClient />;
}
