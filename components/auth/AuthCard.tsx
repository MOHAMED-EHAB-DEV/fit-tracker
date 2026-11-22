import React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/shared/BrandMark";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** The frame shared by the sign-in, sign-up and password screens. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href="/" aria-label="FitTracker home" className="mb-5 rounded-[12px]">
          <BrandMark size={48} />
        </Link>
        <h1 className="text-title text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      <div className="rounded-card border border-line bg-surface p-5 sm:p-6">{children}</div>
      {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
    </div>
  );
}

export const AUTH_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-control font-medium text-accent underline underline-offset-4 transition-colors hover:text-ink";

/** A plain check for an address with one @ and a dot after it; the server checks it again. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_PROBLEM = "Enter an email address like name@example.com.";

/** After a failed check: move to the first field marked wrong (aria-invalid, or data-invalid on radios), once its message is shown. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  window.setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid]')?.focus(), 0);
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control border border-line bg-recessed px-3 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}

export default AuthCard;
