/**
 * Energy from walking. One definition, shared by the server (day totals) and
 * the browser (live step counter), so both always show the same number.
 */

/** Active kilocalories per step (an average adult; walking above resting). */
export const KCAL_PER_STEP = 0.04;

export function stepCalories(steps: number | null | undefined): number {
  return Math.max(0, Math.round((steps || 0) * KCAL_PER_STEP));
}
