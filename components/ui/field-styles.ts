/**
 * Shared look for every form control (Input, Textarea, Select, NumberField),
 * so fields match wherever they appear.
 */

/** Label above a field. */
export const FIELD_LABEL = "block text-[13px] leading-5 font-medium text-ink-2 select-none";

/** Helper text under a field. */
export const FIELD_DESCRIPTION = "text-xs text-ink-3";

/** Error text under a field. */
export const FIELD_ERROR = "text-xs font-medium text-danger";

/**
 * The field box itself: the elevated tone and a hairline. Focus is shown by
 * the border turning accent, with no extra ring.
 */
export const FIELD_BOX =
  "bg-elevated border border-line rounded-control text-ink transition-colors hover:not-focus-within:border-line-strong focus-within:border-accent";

/** Added to FIELD_BOX when the value is invalid. */
export const FIELD_BOX_INVALID = "border-danger hover:not-focus-within:border-danger focus-within:border-danger";

/** Added to FIELD_BOX when the field is disabled. */
export const FIELD_BOX_DISABLED = "opacity-50 cursor-not-allowed pointer-events-none";

/** Height of a field, by size. Both stay at least 44px tall; 16px text keeps iOS from zooming on focus. */
export const FIELD_SIZE = {
  sm: "min-h-11 text-base",
  md: "min-h-12 text-base",
} as const;

export type FieldSize = keyof typeof FIELD_SIZE;
