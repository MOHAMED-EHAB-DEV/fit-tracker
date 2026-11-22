import React from "react";

/** Centered single-column frame for the sign-in, sign-up and password screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-canvas px-4 py-[max(1.5rem,env(safe-area-inset-top))] text-ink">
      {children}
    </main>
  );
}
