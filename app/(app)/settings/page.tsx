import type { Metadata } from "next";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your profile, daily targets, units and account.",
};

/** The signed-in user comes from the app layout's provider; nothing is fetched here. */
export default function SettingsPage() {
  return <SettingsClient />;
}
