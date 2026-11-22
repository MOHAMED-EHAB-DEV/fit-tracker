"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AUTH_LINK_CLASS, AuthCard, EMAIL_PATTERN, EMAIL_PROBLEM, FormError, focusFirstInvalid } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { api, errorMessage } from "@/lib/client/api";
import { notifyNativeLogout } from "@/services/webview-bridge";

interface LoginResponse {
  user?: { isProfileComplete?: boolean };
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Nobody is signed in here (signed-in users never see this page): the Android
  // app forgets the previous account's steps, reminders and widgets, so none of
  // it can be uploaded into the next account that signs in on this phone.
  useEffect(() => {
    notifyNativeLogout();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setError(null);
    const problems = {
      email: EMAIL_PATTERN.test(email.trim()) ? undefined : EMAIL_PROBLEM,
      password: password ? undefined : "Enter your password.",
    };
    setFieldErrors(problems);
    if (problems.email || problems.password) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      // replace(): Back must not return to the sign-in form.
      router.replace(data.user?.isProfileComplete ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch (err) {
      // The 401 here means wrong details, not an expired session.
      const status = (err as { status?: number })?.status;
      setError(status === 401 ? "Wrong email or password." : errorMessage(err, "Could not sign in. Please try again."));
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to FitTracker"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className={AUTH_LINK_CLASS}>
            Create an account
          </Link>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormError message={error} />

        <Input
          id="login-email"
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
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          autoComplete="current-password"
          error={fieldErrors.password}
        />

        <Button type="submit" size="lg" className="w-full" isLoading={isLoading}>
          Sign in
        </Button>

        <p className="text-center">
          <Link href="/forgot-password" className={AUTH_LINK_CLASS}>
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

export default LoginForm;
