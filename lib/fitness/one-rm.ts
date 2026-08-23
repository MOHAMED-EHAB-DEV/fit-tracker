/**
 * Calculates Estimated One Rep Max (1RM) using the Epley formula:
 * 1RM = Weight × (1 + Reps / 30)
 * Valid for reps 1-12. If reps === 1, returns weight.
 */
export function calculateOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/**
 * Checks if a new set is a Personal Record (PR) compared to the all-time max 1RM.
 * Strict greater than (>).
 */
export function isNewPR(weight: number, reps: number, priorMax1RM: number | null): boolean {
  if (!priorMax1RM || priorMax1RM <= 0) {
    // If there is no prior log, it's the baseline, not a PR flag
    return false;
  }
  const current1RM = calculateOneRM(weight, reps);
  return current1RM > priorMax1RM;
}
