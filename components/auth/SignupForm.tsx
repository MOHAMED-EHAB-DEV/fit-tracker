"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, Lock, Mail, User as UserIcon, ArrowRight, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create account");
      }

      // Successful signup -> Navigate to onboarding flow
      router.push("/onboarding");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl shadow-emerald-950/20 text-zinc-100">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 mb-4 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
            <Dumbbell className="w-7 h-7 text-emerald-400" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Account</h1>
        <p className="text-sm text-zinc-400 mt-1">Start tracking your workouts & nutrition with AI</p>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signup-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
            Full Name
          </label>
          <div className="relative">
            <UserIcon className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mohamed"
              required
              autoComplete="name"
              className="w-full pl-11 pr-4 py-3 min-h-[44px] bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="signup-email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="w-full pl-11 pr-4 py-3 min-h-[44px] bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition"
            />
          </div>
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 select-none">
            Password
          </label>
          <div className="relative">
            <Lock className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full pl-11 pr-11 py-3 min-h-[44px] bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full mt-2 py-3.5 px-4 min-h-[44px] bg-linear-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer active:scale-98"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            <>
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-400 hover:text-emerald-300 transition underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default SignupForm;
