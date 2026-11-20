"use client";

import React, { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AUTH_INPUT_CLASS } from "@/components/auth/AuthCard";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  /** Shown under the field, e.g. the length rule. */
  hint?: string;
  error?: string | null;
  required?: boolean;
}

/** Password input with a show/hide button that is large enough to tap. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  required = true,
}: PasswordFieldProps) {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-zinc-200">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          maxLength={128}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(AUTH_INPUT_CLASS, "pe-14")}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          className="absolute end-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:text-white cursor-pointer"
        >
          {isVisible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-zinc-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export default PasswordField;
