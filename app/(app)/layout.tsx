import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getClientUser, LOGIN_REDIRECT } from "@/lib/auth/session";
import { getActiveSession } from "@/lib/workouts/sessions";
import { UserProvider } from "@/context/UserContext";
import { NavRail } from "@/components/shared/NavRail";
import { TabBar } from "@/components/shared/TabBar";
import { AppHeader } from "@/components/shared/AppHeader";
import { AppContent } from "@/components/shared/AppContent";
import { HeaderSlotProvider } from "@/components/shared/HeaderSlot";
import { AppLifecycle } from "@/components/shared/AppLifecycle";
import { ActiveSessionBar } from "@/components/workout/ActiveSessionBar";
import { InstallPwaBanner } from "@/components/pwa/InstallPwaBanner";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
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
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[90] focus:rounded-control focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-inverse"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-canvas text-ink">
        <NavRail />
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col pb-nav outline-none">
          <HeaderSlotProvider>
            <AppHeader />
            <AppContent>{children}</AppContent>
          </HeaderSlotProvider>
        </main>
      </div>
      <TabBar />
      <ActiveSessionBar initial={active} />
      <InstallPwaBanner />
      <AppLifecycle />
    </UserProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-canvas text-ink" aria-busy="true" aria-label="Loading">
      <div className="hidden h-dvh w-(--rail-width) shrink-0 border-e border-line md:block" />
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="skeleton mb-4 h-7 w-40" />
        <ScreenSkeleton />
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
