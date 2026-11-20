"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";

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
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      label={label}
      description={hint}
      errorMessage={error}
      isInvalid={Boolean(error)}
      type={isVisible ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      required={required}
      maxLength={128}
      endContent={
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
          className="grid h-11 w-11 place-items-center rounded-lg text-zinc-400 hover:text-white cursor-pointer"
        >
          {isVisible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>
      }
    />
  );
}

export default PasswordField;
