import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/errors";
import { objectId } from "@/lib/validation/common";
import { findSessionIdByLegacyId, getActiveSession, getSession } from "@/lib/workouts/sessions";
import { SessionDetail } from "@/components/workout/SessionDetail";
import type { SessionDTO } from "@/lib/workouts/types";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageSession();
  if (!objectId.safeParse(id).success) notFound();

  let workout: SessionDTO;
  try {
    workout = await getSession(session.userId, id);
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 404)) throw err;
    // Links saved before the workout system was rebuilt carry the old id.
    const currentId = await findSessionIdByLegacyId(session.userId, id);
    if (currentId) redirect(`/workouts/history/${currentId}`);
    notFound();
  }

  // A workout that is still open belongs on the workout screen.
  if (workout.status === "in_progress") redirect(`/workouts/session/${workout.id}`);

  const active = await getActiveSession(session.userId);
  return <SessionDetail session={workout} active={active ? { id: active.id, name: active.name } : null} />;
}
