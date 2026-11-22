/**
 * State logic for the live workout screen. Pure functions only (no React, no
 * network), so the rules of logging a set are easy to test:
 *
 *  - every update returns new objects (nothing is mutated in place);
 *  - ticking a set with empty boxes logs the suggested values (last time's
 *    numbers, then the routine's targets, then the set before it);
 *  - a set is never ticked without the values its exercise type needs.
 */
import type { SetType, TrackingType } from "@/lib/workouts/taxonomy";
import type {
  ExerciseDTO,
  PreviousPerformanceDTO,
  SessionDTO,
  SessionExerciseDTO,
  SessionSetDTO,
} from "@/lib/workouts/types";
import type { WeightUnit } from "@/lib/fitness/units";
import { isSetLogged } from "@/lib/workouts/calc";

/** A 24-character hex id the server accepts as a new document id. */
export function newId(): string {
  const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  let random = "";
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  for (const byte of bytes) random += byte.toString(16).padStart(2, "0");
  return time + random;
}

export interface SetValues {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export function emptySet(type: SetType = "working", targets: Partial<SessionSetDTO> = {}): SessionSetDTO {
  return {
    id: newId(),
    type,
    weightKg: null,
    reps: null,
    durationSec: null,
    distanceM: null,
    rpe: null,
    done: false,
    doneAt: null,
    targetRepMin: null,
    targetRepMax: null,
    targetWeightKg: null,
    targetDurationSec: null,
    prKinds: [],
    ...targets,
  };
}

/** The n-th previous set of the same kind (warm-ups match warm-ups). */
function previousSetFor(
  exercise: SessionExerciseDTO,
  setIndex: number,
  previous: PreviousPerformanceDTO | undefined
): PreviousPerformanceDTO["sets"][number] | undefined {
  if (!previous) return undefined;
  const set = exercise.sets[setIndex];
  if (!set) return undefined;
  const isWarmup = set.type === "warmup";
  const position = exercise.sets.slice(0, setIndex).filter((other) => (other.type === "warmup") === isWarmup).length;
  const sameKind = previous.sets.filter((other) => (other.type === "warmup") === isWarmup);
  return sameKind[position] || (isWarmup ? undefined : sameKind[sameKind.length - 1]);
}

/**
 * What to show as the hint for a set and what to log when it is ticked with
 * empty boxes: last time's numbers, else the routine's targets, else the
 * closest earlier logged set of this exercise.
 *
 * If the user went heavier or lighter than last time on the set before, the
 * same change is carried to this set (80 last time, 85 today on set 1: set 2
 * suggests last time's weight for set 2 plus 5), so one typed number is
 * enough to move a whole exercise up.
 */
export function suggestedValues(
  exercise: SessionExerciseDTO,
  setIndex: number,
  previous: PreviousPerformanceDTO | undefined
): SetValues {
  const set = exercise.sets[setIndex];
  const isWarmup = set?.type === "warmup";
  const last = previousSetFor(exercise, setIndex, previous);

  let earlierIndex = -1;
  for (let index = setIndex - 1; index >= 0; index -= 1) {
    const other = exercise.sets[index];
    if (isSetLogged(other, exercise.trackingType) && (other.type === "warmup") === isWarmup) {
      earlierIndex = index;
      break;
    }
  }
  const earlier = earlierIndex >= 0 ? exercise.sets[earlierIndex] : undefined;

  let weightKg = last?.weightKg ?? set?.targetWeightKg ?? earlier?.weightKg ?? null;
  if (last?.weightKg != null && earlier?.weightKg != null) {
    const earlierLast = previousSetFor(exercise, earlierIndex, previous);
    if (earlierLast?.weightKg != null && earlier.weightKg !== earlierLast.weightKg) {
      weightKg = Math.max(0, Math.round((last.weightKg + earlier.weightKg - earlierLast.weightKg) * 1000) / 1000);
    }
  }

  return {
    weightKg,
    reps: last?.reps ?? set?.targetRepMax ?? set?.targetRepMin ?? earlier?.reps ?? null,
    durationSec: last?.durationSec ?? set?.targetDurationSec ?? earlier?.durationSec ?? null,
    distanceM: last?.distanceM ?? earlier?.distanceM ?? null,
  };
}

/** Last time's matching set for the "Prev" column (warm-ups match warm-ups). */
export function previousSetValues(
  exercise: SessionExerciseDTO,
  setIndex: number,
  previous: PreviousPerformanceDTO | undefined
): SetValues | null {
  const last = previousSetFor(exercise, setIndex, previous);
  if (!last) return null;
  return {
    weightKg: last.weightKg ?? null,
    reps: last.reps ?? null,
    durationSec: last.durationSec ?? null,
    distanceM: last.distanceM ?? null,
  };
}

/** Where a set sits in the workout. */
export interface SetLocation {
  exerciseId: string;
  setId: string;
  exerciseIndex: number;
  setIndex: number;
}

/**
 * The first set that is not ticked yet, in workout order. With
 * `fromExerciseId` the search starts at that exercise and wraps round to the
 * ones before it.
 * Null when every set is done (or there are none).
 */
export function nextOpenSet(
  session: Pick<SessionDTO, "exercises">,
  fromExerciseId?: string | null
): SetLocation | null {
  const { exercises } = session;
  if (exercises.length === 0) return null;
  const start = fromExerciseId ? Math.max(0, exercises.findIndex((exercise) => exercise.id === fromExerciseId)) : 0;
  for (let step = 0; step < exercises.length; step += 1) {
    const exerciseIndex = (start + step) % exercises.length;
    const exercise = exercises[exerciseIndex];
    const setIndex = exercise.sets.findIndex((set) => !set.done);
    if (setIndex >= 0) {
      return { exerciseId: exercise.id, setId: exercise.sets[setIndex].id, exerciseIndex, setIndex };
    }
  }
  return null;
}

/**
 * The set the live workout is on: the first open set of the exercise the user
 * opened, else the next open set after it. The dock's "Log set" logs this one.
 */
export function activeSet(session: Pick<SessionDTO, "exercises">, focusedExerciseId?: string | null): SetLocation | null {
  return nextOpenSet(session, focusedExerciseId);
}

/** True when the workout has sets and every one of them is ticked. */
export function allSetsDone(session: Pick<SessionDTO, "exercises">): boolean {
  const sets = session.exercises.flatMap((exercise) => exercise.sets);
  return sets.length > 0 && sets.every((set) => set.done);
}

/** Which value is still missing before a set can be ticked (null = ready). */
export function missingField(
  set: SetValues,
  trackingType: TrackingType
): "weight" | "reps" | "duration" | null {
  switch (trackingType) {
    case "weight_reps":
      if (set.weightKg == null) return "weight";
      if (!set.reps || set.reps < 1) return "reps";
      return null;
    case "bodyweight_reps":
      return !set.reps || set.reps < 1 ? "reps" : null;
    case "duration":
      return !set.durationSec || set.durationSec < 1 ? "duration" : null;
    case "cardio":
      return (!set.durationSec || set.durationSec < 1) && !(set.distanceM && set.distanceM > 0) ? "duration" : null;
    default:
      return null;
  }
}

/**
 * Ticks a set. Empty values are filled from `suggestion`. Returns the set
 * unchanged with `missing` set when it still lacks a required value.
 */
export function completeSet(
  set: SessionSetDTO,
  trackingType: TrackingType,
  suggestion: SetValues,
  now: Date = new Date()
): { set: SessionSetDTO; missing: "weight" | "reps" | "duration" | null } {
  const filled: SessionSetDTO = {
    ...set,
    weightKg: set.weightKg ?? (trackingType === "bodyweight_reps" ? null : suggestion.weightKg),
    reps: set.reps ?? suggestion.reps,
    durationSec: set.durationSec ?? suggestion.durationSec,
    distanceM: set.distanceM ?? suggestion.distanceM,
  };
  const missing = missingField(filled, trackingType);
  if (missing) return { set, missing };
  return { set: { ...filled, done: true, doneAt: now.toISOString() }, missing: null };
}

/**
 * For workouts typed in afterwards (a past workout, or an edit of a finished
 * one): a set whose boxes are filled counts as done even if its tick was not
 * pressed, so nothing the user typed is dropped on save.
 */
export function tickValuedSets(session: SessionDTO): SessionDTO {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) =>
        !set.done && missingField(set, exercise.trackingType) === null
          ? { ...set, done: true, doneAt: set.doneAt ?? session.startedAt }
          : set
      ),
    })),
  };
}

export type SessionAction =
  | { type: "hydrate"; session: SessionDTO }
  | { type: "meta"; patch: Partial<Pick<SessionDTO, "name" | "notes" | "startedAt" | "durationSec">> }
  | { type: "version"; version: number }
  | { type: "set/update"; exerciseId: string; setId: string; patch: Partial<SessionSetDTO> }
  | { type: "set/replace"; exerciseId: string; set: SessionSetDTO }
  | { type: "set/add"; exerciseId: string; set: SessionSetDTO }
  | { type: "set/remove"; exerciseId: string; setId: string }
  | { type: "set/restore"; exerciseId: string; set: SessionSetDTO; index: number }
  | { type: "exercise/add"; exercises: SessionExerciseDTO[] }
  | { type: "exercise/remove"; exerciseId: string }
  | { type: "exercise/restore"; exercise: SessionExerciseDTO; index: number }
  | { type: "exercise/move"; exerciseId: string; direction: -1 | 1 }
  | { type: "exercise/update"; exerciseId: string; patch: Partial<Pick<SessionExerciseDTO, "unit" | "restSec" | "notes">> }
  | { type: "exercise/replace"; exerciseId: string; replacement: SessionExerciseDTO };

function mapExercise(
  state: SessionDTO,
  exerciseId: string,
  update: (exercise: SessionExerciseDTO) => SessionExerciseDTO
): SessionDTO {
  return {
    ...state,
    exercises: state.exercises.map((exercise) => (exercise.id === exerciseId ? update(exercise) : exercise)),
  };
}

export function sessionReducer(state: SessionDTO, action: SessionAction): SessionDTO {
  switch (action.type) {
    case "hydrate":
      return action.session;
    case "meta":
      return { ...state, ...action.patch };
    case "version":
      return { ...state, version: action.version };
    case "set/update":
      return mapExercise(state, action.exerciseId, (exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => {
          if (set.id !== action.setId) return set;
          const next = { ...set, ...action.patch };
          // Editing a ticked set so that it is no longer valid un-ticks it.
          if (next.done && !isSetLogged(next, exercise.trackingType)) {
            return { ...next, done: false, doneAt: null };
          }
          return next;
        }),
      }));
    case "set/replace":
      return mapExercise(state, action.exerciseId, (exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => (set.id === action.set.id ? action.set : set)),
      }));
    case "set/add":
      return mapExercise(state, action.exerciseId, (exercise) => ({
        ...exercise,
        sets: [...exercise.sets, action.set],
      }));
    case "set/remove":
      return mapExercise(state, action.exerciseId, (exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => set.id !== action.setId),
      }));
    case "set/restore":
      return mapExercise(state, action.exerciseId, (exercise) => {
        const sets = [...exercise.sets];
        sets.splice(Math.min(action.index, sets.length), 0, action.set);
        return { ...exercise, sets };
      });
    case "exercise/add":
      return { ...state, exercises: [...state.exercises, ...action.exercises] };
    case "exercise/remove":
      return { ...state, exercises: state.exercises.filter((exercise) => exercise.id !== action.exerciseId) };
    case "exercise/restore": {
      const exercises = [...state.exercises];
      exercises.splice(Math.min(action.index, exercises.length), 0, action.exercise);
      return { ...state, exercises };
    }
    case "exercise/move": {
      const index = state.exercises.findIndex((exercise) => exercise.id === action.exerciseId);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= state.exercises.length) return state;
      const exercises = [...state.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...state, exercises };
    }
    case "exercise/update":
      return mapExercise(state, action.exerciseId, (exercise) => ({ ...exercise, ...action.patch }));
    case "exercise/replace":
      return mapExercise(state, action.exerciseId, () => action.replacement);
    default:
      return state;
  }
}

/** A session exercise for a catalog entry, shaped like the user's last time. */
export function exerciseFromCatalog(
  exercise: ExerciseDTO,
  unit: WeightUnit,
  previous: PreviousPerformanceDTO | undefined,
  defaultRestSec: number | null
): SessionExerciseDTO {
  const lastSets = previous?.sets || [];
  const sets: SessionSetDTO[] =
    lastSets.length > 0
      ? lastSets.map((set) =>
          emptySet(set.type, {
            targetWeightKg: set.weightKg,
            targetRepMin: set.reps,
            targetRepMax: set.reps,
            targetDurationSec: set.durationSec,
          })
        )
      : [emptySet(), emptySet(), emptySet()];

  return {
    id: newId(),
    exerciseId: exercise.id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    muscleGroup: exercise.muscleGroup,
    trackingType: exercise.trackingType,
    unit,
    restSec: defaultRestSec,
    notes: "",
    supersetGroup: null,
    sets,
  };
}

/** The request body for saving or finishing a session. */
export function toSessionInput(session: SessionDTO) {
  return session.exercises.map((exercise) => ({
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    unit: exercise.unit,
    restSec: exercise.restSec,
    notes: exercise.notes,
    supersetGroup: exercise.supersetGroup,
    sets: exercise.sets.map((set) => ({
      id: set.id,
      type: set.type,
      weightKg: set.weightKg,
      reps: set.reps,
      durationSec: set.durationSec,
      distanceM: set.distanceM,
      rpe: set.rpe,
      done: set.done,
      doneAt: set.doneAt,
      targetRepMin: set.targetRepMin,
      targetRepMax: set.targetRepMax,
      targetWeightKg: set.targetWeightKg,
      targetDurationSec: set.targetDurationSec,
    })),
  }));
}

// ---------------------------------------------------------------------------
// Local draft: the session as last seen on this device. It survives a reload,
// a killed app and a lost connection, and is sent to the server when possible.
// ---------------------------------------------------------------------------

interface SessionDraft {
  session: SessionDTO;
  /** True while the draft holds changes the server has not confirmed. */
  dirty: boolean;
  savedAt: number;
}

const draftKey = (sessionId: string) => `ft:session:${sessionId}`;

export function loadDraft(sessionId: string): SessionDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    return parsed?.session?.id === sessionId ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDraft(session: SessionDTO, dirty: boolean): void {
  try {
    const draft: SessionDraft = { session, dirty, savedAt: Date.now() };
    window.localStorage.setItem(draftKey(session.id), JSON.stringify(draft));
  } catch {
    // Storage full or unavailable: the server copy is still the fallback.
  }
}

export function clearDraft(sessionId: string): void {
  try {
    window.localStorage.removeItem(draftKey(sessionId));
  } catch {
    // Nothing to clear.
  }
}

/** Removes drafts of workouts that are no longer in progress. */
export function pruneDrafts(activeSessionId: string | null): void {
  try {
    const stale: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (key.startsWith("ft:session:") && key !== draftKey(activeSessionId || "")) stale.push(key);
      if (key.startsWith("ft:rest:") && key !== `ft:rest:${activeSessionId || ""}`) stale.push(key);
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage unavailable: nothing to prune.
  }
}

/**
 * Chooses between the server's copy and this device's draft when the screen
 * opens: unsent local changes win unless the server copy is newer.
 */
export function pickStartingState(server: SessionDTO, draft: SessionDraft | null): { session: SessionDTO; needsSync: boolean } {
  if (!draft || !draft.dirty || server.status !== "in_progress") return { session: server, needsSync: false };
  if (draft.session.version < server.version) return { session: server, needsSync: false };
  return { session: { ...draft.session, version: server.version }, needsSync: true };
}
