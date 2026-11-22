import React from "react";
import type { Metadata } from "next";
import { CoachClient } from "@/components/coach/CoachClient";

export const metadata: Metadata = {
  title: "Coach",
  description: "Chat with your AI coach, run slash commands and look back over your training and eating.",
};

interface CoachPageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  const { from } = await searchParams;
  // Only an in-app path: it orders the suggestions and is where Close goes back to.
  const origin = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : null;
  return <CoachClient from={origin} />;
}
