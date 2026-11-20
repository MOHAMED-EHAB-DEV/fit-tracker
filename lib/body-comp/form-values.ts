/** Check-in form state <-> API payload (pure, isomorphic). */
import type { WeightUnit } from "@/lib/fitness/units";
import { MEASUREMENT_KEYS, NOTES_MAX, type MeasurementKey } from "@/lib/validation/body-comp";
import type { CheckInDTO } from "@/lib/body-comp/dto";
import {
  lengthInputValue,
  lengthUnitFor,
  parseBodyFatInput,
  parseLengthInput,
  parseWeightInput,
  weightInputValue,
} from "@/lib/body-comp/units";

export interface CheckInFormValues {
  weight: string;
  bodyFat: string;
  measurements: Record<MeasurementKey, string>;
  notes: string;
  dateString: string;
}

export type CheckInFormErrors = Partial<Record<"weight" | "bodyFat" | "notes" | "dateString" | MeasurementKey, string>>;

export interface CheckInPayload {
  weightKg: number | null;
  bodyFatPercent: number | null;
  /** Centimetres; null when every field is empty. */
  measurements: Record<MeasurementKey, number | null> | null;
  notes: string;
  dateString: string;
}

export function emptyCheckInValues(todayDateString: string): CheckInFormValues {
  return {
    weight: "",
    bodyFat: "",
    measurements: { chest: "", waist: "", hips: "", arms: "", thighs: "" },
    notes: "",
    dateString: todayDateString,
  };
}

export function valuesFromCheckIn(checkIn: CheckInDTO, unit: WeightUnit): CheckInFormValues {
  const lengthUnit = lengthUnitFor(unit);
  const m = checkIn.measurements;
  return {
    weight: weightInputValue(checkIn.weightKg, unit),
    bodyFat: checkIn.bodyFatPercent == null ? "" : String(checkIn.bodyFatPercent),
    measurements: {
      chest: lengthInputValue(m?.chest, lengthUnit),
      waist: lengthInputValue(m?.waist, lengthUnit),
      hips: lengthInputValue(m?.hips, lengthUnit),
      arms: lengthInputValue(m?.arms, lengthUnit),
      thighs: lengthInputValue(m?.thighs, lengthUnit),
    },
    notes: checkIn.notes,
    dateString: checkIn.dateString,
  };
}

/** Validates the form in the user's units and converts it to kg / cm. */
export function parseCheckInValues(
  values: CheckInFormValues,
  unit: WeightUnit,
  todayDateString: string
): { payload: CheckInPayload; errors: CheckInFormErrors; hasErrors: boolean } {
  const errors: CheckInFormErrors = {};
  const weight = parseWeightInput(values.weight, unit);
  if (weight.error) errors.weight = weight.error;
  const bodyFat = parseBodyFatInput(values.bodyFat);
  if (bodyFat.error) errors.bodyFat = bodyFat.error;

  const lengthUnit = lengthUnitFor(unit);
  const measurements = {} as Record<MeasurementKey, number | null>;
  let anyMeasurement = false;
  for (const key of MEASUREMENT_KEYS) {
    const parsed = parseLengthInput(values.measurements[key], lengthUnit);
    if (parsed.error) errors[key] = parsed.error;
    measurements[key] = parsed.value;
    if (parsed.value !== null) anyMeasurement = true;
  }

  const notes = values.notes.trim();
  if (notes.length > NOTES_MAX) errors.notes = `Notes can be at most ${NOTES_MAX} characters.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateString)) errors.dateString = "Pick a date.";
  else if (values.dateString > todayDateString) errors.dateString = "The date can't be in the future.";

  return {
    payload: {
      weightKg: weight.value,
      bodyFatPercent: bodyFat.value,
      measurements: anyMeasurement ? measurements : null,
      notes,
      dateString: values.dateString,
    },
    errors,
    hasErrors: Object.keys(errors).length > 0,
  };
}
