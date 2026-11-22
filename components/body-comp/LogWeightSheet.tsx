"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { errorMessage, requestJson } from "@/components/habits/api";
import { parseWeightInput, weightBounds } from "@/lib/body-comp/units";
import type { WeightUnit } from "@/lib/fitness/units";
import type { CheckInDTO } from "@/lib/body-comp/dto";

interface LogWeightSheetProps {
  isOpen: boolean;
  onClose: () => void;
  weightUnit: WeightUnit;
  today: string;
  /** The last weight, as a hint. */
  lastWeight: string | null;
  onSaved: (checkIn: CheckInDTO, profileWeightKg: number | null) => void;
}

/** Log weight: one number (and the day, today unless changed). */
export function LogWeightSheet(props: LogWeightSheetProps) {
  return <LogWeightSheetInner key={props.isOpen ? "open" : "closed"} {...props} />;
}

function LogWeightSheetInner({ isOpen, onClose, weightUnit, today, lastWeight, onSaved }: LogWeightSheetProps) {
  const [weight, setWeight] = useState("");
  const [dateString, setDateString] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const bounds = weightBounds(weightUnit);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const parsed = parseWeightInput(weight, weightUnit);
    if (parsed.error || parsed.value === null) {
      setError(parsed.error ?? `Enter your weight in ${weightUnit}.`);
      return;
    }
    if (!dateString || dateString > today) {
      setError("Choose today or an earlier day.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("weightKg", String(parsed.value));
      form.append("dateString", dateString);
      const data = await requestJson<{ success: true; checkIn: CheckInDTO; profileWeightKg: number | null }>("/api/body-comp", {
        method: "POST",
        body: form,
      });
      onSaved(data.checkIn, data.profileWeightKg);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save the weight. Please try again."));
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title="Log weight"
      size="sm"
      footer={
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="log-weight-form" isLoading={saving}>
            Save
          </Button>
        </div>
      }
    >
      <form id="log-weight-form" onSubmit={submit} noValidate className="space-y-3">
        <Input
          label="Weight"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          data-autofocus
          value={weight}
          onChange={(event) => {
            setWeight(event.target.value.replace(",", "."));
            if (error) setError(null);
          }}
          placeholder={lastWeight ?? (weightUnit === "lbs" ? "173.1" : "78.5")}
          endContent={<span className="pe-1 text-sm text-ink-3">{weightUnit}</span>}
          isInvalid={Boolean(error)}
          errorMessage={error ?? undefined}
          description={`Between ${bounds.min} and ${bounds.max} ${weightUnit}.`}
          inputClassName="font-mono text-lg tabular-nums"
        />
        <Input
          label="Day"
          type="date"
          value={dateString}
          max={today}
          onChange={(event) => setDateString(event.target.value)}
          inputClassName="font-mono tabular-nums"
        />
      </form>
    </Sheet>
  );
}

export default LogWeightSheet;
