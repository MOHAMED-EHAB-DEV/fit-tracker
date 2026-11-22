"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AUTH_LINK_CLASS, AuthCard, EMAIL_PATTERN, EMAIL_PROBLEM, FormError, focusFirstInvalid } from "@/components/auth/AuthCard";
import { api, errorMessage } from "@/lib/client/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError(EMAIL_PROBLEM);
      focusFirstInvalid(formRef.current);
      return;
    }
    setIsLoading(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { email: email.trim() } });
      setSentTo(email.trim());
    } catch (err) {
      setError(errorMessage(err, "The request could not be sent. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <Link href="/login" className={AUTH_LINK_CLASS}>
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthCard title="Check your email" footer={footer}>
        <div role="status" className="space-y-3 text-sm leading-6 text-ink-2">
          <p>
            If an account exists for <span className="font-medium break-all text-ink">{sentTo}</span>, a link to
            choose a new password is on its way. It works once and expires in 30 minutes.
          </p>
          <p className="text-[13px] text-ink-3">
            Nothing after a few minutes? Check your spam folder. If it still does not arrive, ask the person who runs
            this FitTracker for a reset link.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="We will email you a link to choose a new one" footer={footer}>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError message={error} />
        <Input
          id="forgot-email"
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(null);
          }}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          isInvalid={Boolean(emailError)}
          errorMessage={emailError}
        />
        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}

export default ForgotPasswordForm;
