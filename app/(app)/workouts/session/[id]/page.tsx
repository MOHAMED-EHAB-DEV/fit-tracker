import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/errors";
import { objectId } from "@/lib/validation/common";
import { findSessionIdByLegacyId, getPreviousPerformance, getSession } from "@/lib/workouts/sessions";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { SessionScreen } from "@/components/workout/SessionScreen";
import type { SessionDTO } from "@/lib/workouts/types";

export const metadata: Metadata = { title: "Workout" };

function SessionSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true" aria-label="Loading workout">
      <div className="skeleton h-12" />
      <div className="skeleton h-48 rounded-3xl" />
      <div className="skeleton h-48 rounded-3xl" />
    </div>
  );
}

/**
 * The workout screen: live for a workout in progress, an editor for a
 * finished one. Opening it never changes anything.
 */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
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
    if (currentId) redirect(`/workouts/session/${currentId}`);
    notFound();
  }

  const previous =
    workout.status === "in_progress"
      ? await getPreviousPerformance(
          session.userId,
          workout.exercises.map((exercise) => exercise.exerciseId),
          workout.id
        )
      : [];

  return (
    <ClientOnly fallback={<SessionSkeleton />}>
      <SessionScreen key={`${workout.id}:${workout.status}`} initialSession={workout} initialPrevious={previous} />
    </ClientOnly>
  );
}
