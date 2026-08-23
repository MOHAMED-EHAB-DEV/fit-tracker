import React from "react";
import { Metadata } from "next";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata: Metadata = {
  title: "Account & Fitness Settings — AI Fit Tracker",
  description: "Configure your personal metrics, metabolic targets, and application preferences.",
};

export default function SettingsPage() {
  return <SettingsClient />;
}
