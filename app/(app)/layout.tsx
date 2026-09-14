import React, { Suspense } from "react";
import { getFullUser } from "@/lib/auth/session";
import { UserProvider } from "@/context/UserContext";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileNav } from "@/components/shared/MobileNav";
import { InstallPwaBanner } from "@/components/pwa/InstallPwaBanner";
import { redirect } from "next/navigation";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await getFullUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.isProfileComplete) {
    redirect("/onboarding");
  }

  const sanitizedUser = JSON.parse(JSON.stringify(user));

  return (
    <UserProvider initialUser={sanitizedUser}>
      <div className="flex min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-zinc-950">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
          <div className="w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
        <MobileNav />
        <InstallPwaBanner />
      </div>
    </UserProvider>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
          <div className="hidden md:block w-64 h-screen bg-zinc-950 border-r border-zinc-800/80" />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      }
    >
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
