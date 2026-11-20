/**
 * Shared look for every form control (Input, Textarea, Select, NumberField),
 * so fields match wherever they appear.
 */

/** Label above a field. */
export const FIELD_LABEL = "block text-sm font-medium text-zinc-300 select-none";

/** Helper text under a field. */
export const FIELD_DESCRIPTION = "text-xs text-zinc-400";

/** Error text under a field. */
export const FIELD_ERROR = "text-xs font-medium text-red-400";

/** The field box itself: raised surface, thin line, brand focus ring. */
export const FIELD_BOX =
  "bg-surface-2 border border-line rounded-xl text-white transition-colors hover:border-white/20 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25";

/** Added to FIELD_BOX when the value is invalid. */
export const FIELD_BOX_INVALID =
  "border-red-500/80 hover:border-red-500/80 focus-within:border-red-500 focus-within:ring-red-500/25";

/** Added to FIELD_BOX when the field is disabled. */
export const FIELD_BOX_DISABLED = "opacity-50 cursor-not-allowed pointer-events-none";

/** Height of a field, by size. Both stay at least 44px tall; text-base keeps iOS from zooming on focus. */
export const FIELD_SIZE = {
  sm: "min-h-11 text-base",
  md: "min-h-12 text-base",
} as const;

export type FieldSize = keyof typeof FIELD_SIZE;
