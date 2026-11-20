"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AUTH_LINK_CLASS, AuthCard, FormError } from "@/components/auth/AuthCard";
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
    setIsLoading(true);
    try {
      const data = await api<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      // replace(): Back must not return to the sign-in form.
      router.replace(data.user?.isProfileComplete ? "/" : "/onboarding");
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />

        <Input
          id="login-email"
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
        />

        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />

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
