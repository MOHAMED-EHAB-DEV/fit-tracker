"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AUTH_LINK_CLASS, AuthCard, EMAIL_PATTERN, EMAIL_PROBLEM, FormError, focusFirstInvalid } from "@/components/auth/AuthCard";
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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setError(null);
    const problems = {
      name: name.trim() ? undefined : "Enter your name.",
      email: EMAIL_PATTERN.test(email.trim()) ? undefined : EMAIL_PROBLEM,
      password: password.length >= MIN_PASSWORD_LENGTH ? undefined : `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
    setFieldErrors(problems);
    if (problems.name || problems.email || problems.password) {
      focusFirstInvalid(formRef.current);
      return;
    }
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
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError message={error} />

        <Input
          id="signup-name"
          label="Name"
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }}
          autoComplete="name"
          required
          maxLength={80}
          isInvalid={Boolean(fieldErrors.name)}
          errorMessage={fieldErrors.name}
        />

        <Input
          id="signup-email"
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          isInvalid={Boolean(fieldErrors.email)}
          errorMessage={fieldErrors.email}
        />

        <PasswordField
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (fieldErrors.password && value.length >= MIN_PASSWORD_LENGTH) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={fieldErrors.password}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}

export default SignupForm;
