"use client";

import React, { useId, useState } from "react";
import { ChevronDown, Ruler } from "lucide-react";
import type { WeightUnit } from "@/lib/fitness/units";
import { MEASUREMENT_KEYS, NOTES_MAX, type MeasurementKey } from "@/lib/validation/body-comp";
import { lengthBounds, lengthUnitFor, weightBounds } from "@/lib/body-comp/units";
import type { CheckInFormErrors, CheckInFormValues } from "@/lib/body-comp/form-values";

const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  arms: "Arms",
  thighs: "Thighs",
};

const inputClass =
  "w-full min-h-11 px-3.5 bg-zinc-950/80 border rounded-xl text-base text-white placeholder-zinc-500 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

interface CheckInFieldsProps {
  values: CheckInFormValues;
  onChange: (values: CheckInFormValues) => void;
  errors: CheckInFormErrors;
  weightUnit: WeightUnit;
  todayDateString: string;
  disabled?: boolean;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-400">
      {message}
    </p>
  );
}

export function CheckInFields({ values, onChange, errors, weightUnit, todayDateString, disabled }: CheckInFieldsProps) {
  const id = useId();
  const lengthUnit = lengthUnitFor(weightUnit);
  const wBounds = weightBounds(weightUnit);
  const lBounds = lengthBounds(lengthUnit);
  const hasMeasurementValues = MEASUREMENT_KEYS.some((k) => values.measurements[k] !== "");
  const [showMeasurements, setShowMeasurements] = useState(hasMeasurementValues);
  const measurementErrors = MEASUREMENT_KEYS.some((k) => errors[k]);

  const set = (patch: Partial<CheckInFormValues>) => onChange({ ...values, ...patch });
  const border = (error?: string) => (error ? "border-red-500/60" : "border-white/10");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor={`${id}-date`} className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Date
          </label>
          <input
            id={`${id}-date`}
            type="date"
            value={values.dateString}
            max={todayDateString}
            disabled={disabled}
            onChange={(e) => set({ dateString: e.target.value })}
            aria-invalid={Boolean(errors.dateString)}
            aria-describedby={errors.dateString ? `${id}-date-error` : undefined}
            className={`${inputClass} ${border(errors.dateString)}`}
          />
          <FieldError id={`${id}-date-error`} message={errors.dateString} />
        </div>
        <div>
          <label htmlFor={`${id}-weight`} className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Weight ({weightUnit})
          </label>
          <input
            id={`${id}-weight`}
            type="number"
            inputMode="decimal"
            step="any"
            min={wBounds.min}
            max={wBounds.max}
            value={values.weight}
            disabled={disabled}
            onChange={(e) => set({ weight: e.target.value })}
            placeholder={weightUnit === "lbs" ? "e.g. 173.1" : "e.g. 78.5"}
            aria-invalid={Boolean(errors.weight)}
            aria-describedby={errors.weight ? `${id}-weight-error` : undefined}
            className={`${inputClass} ${border(errors.weight)} font-bold`}
          />
          <FieldError id={`${id}-weight-error`} message={errors.weight} />
        </div>
        <div>
          <label htmlFor={`${id}-bf`} className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
            Body fat (%) — measured
          </label>
          <input
            id={`${id}-bf`}
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            max={75}
            value={values.bodyFat}
            disabled={disabled}
            onChange={(e) => set({ bodyFat: e.target.value })}
            placeholder="optional"
            aria-invalid={Boolean(errors.bodyFat)}
            aria-describedby={errors.bodyFat ? `${id}-bf-error` : undefined}
            className={`${inputClass} ${border(errors.bodyFat)}`}
          />
          <FieldError id={`${id}-bf-error`} message={errors.bodyFat} />
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-950/60 border border-white/8">
        <button
          type="button"
          onClick={() => setShowMeasurements((prev) => !prev)}
          aria-expanded={showMeasurements || measurementErrors}
          className="w-full min-h-11 flex items-center justify-between gap-2 px-4 text-sm font-bold text-zinc-200 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-teal-400" aria-hidden="true" />
            Circumference measurements ({lengthUnit}, optional)
          </span>
          <ChevronDown
            className={`w-4 h-4 text-zinc-400 transition-transform ${showMeasurements || measurementErrors ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {(showMeasurements || measurementErrors) && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 px-4 pb-4">
            {MEASUREMENT_KEYS.map((key) => (
              <div key={key}>
                <label htmlFor={`${id}-${key}`} className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  {MEASUREMENT_LABELS[key]} ({lengthUnit})
                </label>
                <input
                  id={`${id}-${key}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={lBounds.min}
                  max={lBounds.max}
                  value={values.measurements[key]}
                  disabled={disabled}
                  onChange={(e) => set({ measurements: { ...values.measurements, [key]: e.target.value } })}
                  aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
                  className={`${inputClass} ${border(errors[key])}`}
                />
                <FieldError id={`${id}-${key}-error`} message={errors[key]} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
          Notes
        </label>
        <textarea
          id={`${id}-notes`}
          value={values.notes}
          maxLength={NOTES_MAX}
          disabled={disabled}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="e.g. Morning fasted weigh-in"
          rows={2}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? `${id}-notes-error` : undefined}
          className={`w-full px-3.5 py-2.5 bg-zinc-950/80 border rounded-xl text-base text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${border(errors.notes)}`}
        />
        <FieldError id={`${id}-notes-error`} message={errors.notes} />
      </div>
    </div>
  );
}
