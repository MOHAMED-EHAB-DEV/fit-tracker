"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AUTH_INPUT_CLASS, AUTH_LINK_CLASS, AuthCard, FormError } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { api, errorMessage } from "@/lib/client/api";
import { detectDeviceTimeZone } from "@/lib/time";

const MIN_PASSWORD_LENGTH = 8;

/** Pounds for the few regions that use them; kilograms everywhere else. Changeable later. */
function defaultWeightUnit(): "kg" | "lbs" {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region && ["US", "LR", "MM"].includes(region) ? "lbs" : "kg";
  } catch {
    return "kg";
  }
}

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setPasswordError(null);
    setIsLoading(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          password,
          // Days, weeks and reminders follow the user's own clock from the start.
          timezone: detectDeviceTimeZone(),
          weightUnit: defaultWeightUnit(),
        },
      });
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not create the account. Please try again."));
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Track training, food and progress in one place"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />

        <div className="space-y-1.5">
          <label htmlFor="signup-name" className="block text-sm font-medium text-zinc-200">
            Name
          </label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
            maxLength={80}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-sm font-medium text-zinc-200">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <PasswordField
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (passwordError && value.length >= MIN_PASSWORD_LENGTH) setPasswordError(null);
          }}
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={passwordError}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

export default SignupForm;
