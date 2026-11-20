import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageSession } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/errors";
import { objectId } from "@/lib/validation/common";
import { getRoutine } from "@/lib/workouts/routines";
import { getActiveSession } from "@/lib/workouts/sessions";
import { RoutineEditor } from "@/components/workout/RoutineEditor";
import type { RoutineDTO } from "@/lib/workouts/types";

export const metadata: Metadata = { title: "Routine" };

export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageSession();
  if (!objectId.safeParse(id).success) notFound();

  let routine: RoutineDTO;
  try {
    routine = await getRoutine(session.userId, id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
  const active = await getActiveSession(session.userId);

  return (
    <RoutineEditor
      key={routine.id}
      initialRoutine={routine}
      active={active ? { id: active.id, name: active.name } : null}
    />
  );
}
