import React from "react";
import { Zap } from "lucide-react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** The frame shared by the sign-in, sign-up and password screens. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-emerald-400">
          <Zap className="h-7 w-7" fill="currentColor" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-zinc-400">{subtitle}</p>}
      </div>
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">{children}</div>
      {footer && <div className="mt-5 text-center text-base text-zinc-400">{footer}</div>}
    </div>
  );
}

export const AUTH_LINK_CLASS =
  "inline-flex min-h-11 items-center font-semibold text-emerald-300 underline underline-offset-4 hover:text-emerald-200";

export const AUTH_INPUT_CLASS =
  "w-full min-h-12 rounded-xl border border-line bg-surface-2 px-3.5 text-base text-white placeholder:text-zinc-500 aria-[invalid=true]:border-red-500";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-300">
      {message}
    </p>
  );
}

export default AuthCard;
