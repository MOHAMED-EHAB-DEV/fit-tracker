import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getClientUser, LOGIN_REDIRECT } from "@/lib/auth/session";
import { getActiveSession } from "@/lib/workouts/sessions";
import { UserProvider } from "@/context/UserContext";
import { Sidebar } from "@/components/shared/Sidebar";
import { BottomNav } from "@/components/shared/BottomNav";
import { AppLifecycle } from "@/components/shared/AppLifecycle";
import { ActiveSessionBar } from "@/components/workout/ActiveSessionBar";
import { InstallPwaBanner } from "@/components/pwa/InstallPwaBanner";
import type { IUser } from "@/lib/db/models/User";
import type { SessionSummaryDTO } from "@/lib/workouts/types";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await getClientUser();

  if (!user) {
    redirect(LOGIN_REDIRECT);
  }

  if (!user.isProfileComplete) {
    redirect("/onboarding");
  }

  // The bar is a convenience: a failure here must never block the app.
  let active: SessionSummaryDTO | null = null;
  try {
    active = await getActiveSession(String(user._id));
  } catch (err) {
    console.error("[layout] could not read the workout in progress", err);
  }

  return (
    <UserProvider initialUser={user as unknown as IUser}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-xl focus:bg-emerald-500 focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-zinc-950"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-app text-ink">
        <Sidebar />
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col pb-nav outline-none">
          <div className="mx-auto w-full max-w-[1400px] px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
      <ActiveSessionBar initial={active} />
      <InstallPwaBanner />
      <AppLifecycle />
    </UserProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-app text-ink" aria-busy="true" aria-label="Loading">
      <div className="hidden h-dvh w-60 border-e border-line md:block" />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton mt-6 h-40 rounded-3xl" />
        <div className="skeleton mt-4 h-40 rounded-3xl" />
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The page is rendered only inside the authenticated shell: the fallback is
  // a skeleton, never the page itself.
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
