import React from "react";
import { Metadata } from "next";
import { CoachClient } from "@/components/coach/CoachClient";

export const metadata: Metadata = {
  title: "AI Coach & Data Analyzer — AI Fit Tracker",
  description: "Chat with your AI fitness coach, run high-density slash commands, and analyze multi-week trends.",
};

export default function CoachPage() {
  return <CoachClient />;
}
