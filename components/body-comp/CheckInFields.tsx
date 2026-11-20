"use client";

import React, { useId, useState } from "react";
import { ChevronDown, Ruler } from "lucide-react";
import type { WeightUnit } from "@/lib/fitness/units";
import { MEASUREMENT_KEYS, NOTES_MAX, type MeasurementKey } from "@/lib/validation/body-comp";
import { lengthBounds, lengthUnitFor, weightBounds } from "@/lib/body-comp/units";
import type { CheckInFormErrors, CheckInFormValues } from "@/lib/body-comp/form-values";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  chest: "Chest",
  waist: "Waist",
  hips: "Hips",
  arms: "Arms",
  thighs: "Thighs",
};

interface CheckInFieldsProps {
  values: CheckInFormValues;
  onChange: (values: CheckInFormValues) => void;
  errors: CheckInFormErrors;
  weightUnit: WeightUnit;
  todayDateString: string;
  disabled?: boolean;
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          id={`${id}-date`}
          label="Date"
          type="date"
          value={values.dateString}
          max={todayDateString}
          disabled={disabled}
          onChange={(e) => set({ dateString: e.target.value })}
          isInvalid={Boolean(errors.dateString)}
          errorMessage={errors.dateString}
          inputClassName="tabular-nums"
        />
        <Input
          id={`${id}-weight`}
          label={`Weight (${weightUnit})`}
          type="number"
          inputMode="decimal"
          step="any"
          min={wBounds.min}
          max={wBounds.max}
          value={values.weight}
          disabled={disabled}
          onChange={(e) => set({ weight: e.target.value })}
          placeholder={weightUnit === "lbs" ? "e.g. 173.1" : "e.g. 78.5"}
          isInvalid={Boolean(errors.weight)}
          errorMessage={errors.weight}
          inputClassName="tabular-nums font-bold"
        />
        <Input
          id={`${id}-bf`}
          label="Body fat (%) — measured"
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          max={75}
          value={values.bodyFat}
          disabled={disabled}
          onChange={(e) => set({ bodyFat: e.target.value })}
          placeholder="optional"
          isInvalid={Boolean(errors.bodyFat)}
          errorMessage={errors.bodyFat}
          inputClassName="tabular-nums"
        />
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
              <Input
                key={key}
                id={`${id}-${key}`}
                label={`${MEASUREMENT_LABELS[key]} (${lengthUnit})`}
                type="number"
                inputMode="decimal"
                step="any"
                min={lBounds.min}
                max={lBounds.max}
                value={values.measurements[key]}
                disabled={disabled}
                onChange={(e) => set({ measurements: { ...values.measurements, [key]: e.target.value } })}
                isInvalid={Boolean(errors[key])}
                errorMessage={errors[key]}
                inputClassName="tabular-nums"
              />
            ))}
          </div>
        )}
      </div>

      <Textarea
        id={`${id}-notes`}
        label="Notes"
        value={values.notes}
        maxLength={NOTES_MAX}
        disabled={disabled}
        onChange={(e) => set({ notes: e.target.value })}
        placeholder="e.g. Morning fasted weigh-in"
        rows={2}
        isInvalid={Boolean(errors.notes)}
        errorMessage={errors.notes}
      />
    </div>
  );
}
