import { formatDuration } from "@/lib/workouts/calc";
import { fromKg, type WeightUnit } from "@/lib/fitness/units";
import type { TrackingType } from "@/lib/workouts/taxonomy";
import type { SetValues } from "@/lib/workouts/session-state";

/** The value boxes of a set, in the order Next moves through them. */
export type LedgerField = "weight" | "reps" | "duration" | "distance";

/**
 * The columns of the set ledger for an exercise type (docs/design/README.md,
 * "Live session"): Set · Prev · values · Done. Bodyweight exercises show the
 * weight column only when a set carries added weight.
 */
export function ledgerFields(trackingType: TrackingType, hasAddedWeight: boolean): LedgerField[] {
  switch (trackingType) {
    case "weight_reps":
      return ["weight", "reps"];
    case "bodyweight_reps":
      return hasAddedWeight ? ["weight", "reps"] : ["reps"];
    case "duration":
      return ["duration"];
    case "cardio":
      return ["duration", "distance"];
    default:
      return ["reps"];
  }
}

/** Full grid templates (static strings so Tailwind generates them). */
const GRID_TWO = "grid-cols-[36px_66px_minmax(0,1.09fr)_minmax(0,1fr)_52px]";
const GRID_ONE_WIDE_PREV = "grid-cols-[36px_minmax(0,114px)_minmax(0,1fr)_52px]";
const GRID_ONE = "grid-cols-[36px_minmax(0,104px)_minmax(0,1fr)_52px]";

export function ledgerGrid(fields: LedgerField[]): string {
  if (fields.length === 2) return GRID_TWO;
  return fields[0] === "reps" ? GRID_ONE_WIDE_PREV : GRID_ONE;
}

export function fieldHeader(field: LedgerField, unit: WeightUnit, trackingType: TrackingType): string {
  switch (field) {
    case "weight":
      return trackingType === "bodyweight_reps" ? `+${unit}` : unit;
    case "reps":
      return "Reps";
    case "duration":
      return trackingType === "cardio" ? "Min" : "Sec";
    case "distance":
      return "km";
  }
}

/** The number shown in a box, in the box's own unit. */
export function fieldValue(values: SetValues, field: LedgerField, unit: WeightUnit, trackingType: TrackingType): number | null {
  switch (field) {
    case "weight":
      return values.weightKg == null ? null : fromKg(values.weightKg, unit, 2);
    case "reps":
      return values.reps;
    case "duration":
      if (values.durationSec == null) return null;
      return trackingType === "cardio" ? Math.round((values.durationSec / 60) * 10) / 10 : values.durationSec;
    case "distance":
      return values.distanceM == null ? null : Math.round(values.distanceM / 10) / 100;
  }
}

/** Decimal places a box accepts. */
export function fieldDecimals(field: LedgerField, trackingType: TrackingType): number {
  if (field === "weight") return 2;
  if (field === "distance") return 2;
  if (field === "duration" && trackingType === "cardio") return 1;
  return 0;
}

/** How far one press of − / + in the keypad bar moves a box. */
export function fieldStep(field: LedgerField, unit: WeightUnit, trackingType: TrackingType): number {
  switch (field) {
    case "weight":
      return unit === "lbs" ? 5 : 2.5;
    case "reps":
      return 1;
    case "duration":
      return trackingType === "cardio" ? 1 : 5;
    case "distance":
      return 0.1;
  }
}

export function fieldMax(field: LedgerField, unit: WeightUnit, trackingType: TrackingType): number {
  switch (field) {
    case "weight":
      return unit === "lbs" ? 4400 : 2000;
    case "reps":
      return 1000;
    case "duration":
      return trackingType === "cardio" ? 1440 : 86_400;
    case "distance":
      return 1000;
  }
}

function trim(value: number, decimals: number): string {
  return String(Math.round(value * 10 ** decimals) / 10 ** decimals);
}

/** "80×8", "×12", "+10×8", "0:45", "20′ · 3.2" for the Prev column. */
export function formatPrev(values: SetValues | null, unit: WeightUnit, trackingType: TrackingType): string {
  if (!values) return "—";
  switch (trackingType) {
    case "weight_reps":
      return values.weightKg != null && values.reps != null ? `${trim(fromKg(values.weightKg, unit, 2), 2)}×${values.reps}` : "—";
    case "bodyweight_reps":
      if (values.reps == null) return "—";
      return values.weightKg ? `+${trim(fromKg(values.weightKg, unit, 2), 2)}×${values.reps}` : `×${values.reps}`;
    case "duration":
      return values.durationSec ? formatDuration(values.durationSec) : "—";
    case "cardio": {
      const parts = [
        values.durationSec ? `${Math.round(values.durationSec / 60)}′` : null,
        values.distanceM ? trim(values.distanceM / 1000, 2) : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" · ") : "—";
    }
    default:
      return "—";
  }
}

/** "80 kg × 8", "12 reps", "0:45", "20 min · 3.2 km": what "Log set" will save. */
export function formatLogValues(values: SetValues, unit: WeightUnit, trackingType: TrackingType): string | null {
  switch (trackingType) {
    case "weight_reps":
      return values.weightKg != null && values.reps
        ? `${trim(fromKg(values.weightKg, unit, 2), 2)} ${unit} × ${values.reps}`
        : null;
    case "bodyweight_reps":
      if (!values.reps) return null;
      return values.weightKg ? `+${trim(fromKg(values.weightKg, unit, 2), 2)} ${unit} × ${values.reps}` : `${values.reps} reps`;
    case "duration":
      return values.durationSec ? formatDuration(values.durationSec) : null;
    case "cardio": {
      const parts = [
        values.durationSec ? `${Math.round(values.durationSec / 60)} min` : null,
        values.distanceM ? `${trim(values.distanceM / 1000, 2)} km` : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    default:
      return null;
  }
}
