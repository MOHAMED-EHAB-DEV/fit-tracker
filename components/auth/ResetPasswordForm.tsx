"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AUTH_LINK_CLASS, AuthCard, FormError } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { api, errorMessage } from "@/lib/client/api";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ password?: string; confirmation?: string }>({});
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading || !token) return;
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError({ password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (password !== confirmation) {
      setFieldError({ confirmation: "The two passwords do not match." });
      return;
    }
    setFieldError({});
    setIsLoading(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", body: { token, password } });
      setIsDone(true);
    } catch (err) {
      setError(errorMessage(err, "The password could not be changed. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthCard title="This link is not valid">
        <div className="space-y-4 text-base text-zinc-300">
          <p>The reset link is incomplete or has already been used.</p>
          <Link href="/forgot-password" className={AUTH_LINK_CLASS}>
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (isDone) {
    return (
      <AuthCard title="Password changed">
        <div role="status" className="space-y-4 text-base text-zinc-300">
          <p>Your new password is saved. Every device that was signed in has been signed out.</p>
          <Link
            href="/login?expired=1"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-6 text-base font-bold text-zinc-950 hover:bg-emerald-400"
          >
            Sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link href="/login" className={AUTH_LINK_CLASS}>
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={fieldError.password}
        />
        <PasswordField
          label="Repeat the new password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          error={fieldError.confirmation}
        />
        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}

export default ResetPasswordForm;
