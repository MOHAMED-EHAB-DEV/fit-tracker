import { getFullUser } from "@/lib/auth/session";
import { type Metadata } from "next";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata: Metadata = {
  title: "Account & Fitness Settings — AI Fit Tracker",
  description: "Configure your personal metrics, metabolic targets, and application preferences.",
};

export default async function SettingsPage() {
  const user = await getFullUser();
  const sanitizedUser = user ? JSON.parse(JSON.stringify(user)) : null;

  return <SettingsClient initialUser={sanitizedUser} />;
}
