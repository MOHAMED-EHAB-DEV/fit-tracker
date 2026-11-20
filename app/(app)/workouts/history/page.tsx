import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth/session";
import { listSessions } from "@/lib/workouts/sessions";
import { HistoryList } from "@/components/workout/HistoryList";

export const metadata: Metadata = {
  title: "Workout history",
  description: "Every workout you have finished.",
};

export default async function WorkoutHistoryPage() {
  const session = await requirePageSession();
  const { sessions, nextCursor } = await listSessions(session.userId, { limit: 20 });
  return <HistoryList initialSessions={sessions} initialCursor={nextCursor} />;
}
