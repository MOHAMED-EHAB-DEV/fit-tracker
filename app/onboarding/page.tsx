import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFullUser, LOGIN_REDIRECT } from "@/lib/auth/session";
import { normalizeWeightUnit } from "@/lib/fitness/units";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await getFullUser();
  if (!user) redirect(LOGIN_REDIRECT);
  // Already set up: onboarding is a one-time step.
  if (user.isProfileComplete) redirect("/");

  return (
    // Saved answers live on the device, so the form is rendered in the browser only.
    <ClientOnly
      fallback={
        <div role="status" aria-label="Loading" className="mx-auto min-h-dvh w-full max-w-md space-y-6 bg-app px-4 pt-8">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-40 rounded-3xl" />
        </div>
      }
    >
      <OnboardingFlow
        userName={user.name || ""}
        initialWeightUnit={normalizeWeightUnit(user.preferences?.weightUnit)}
      />
    </ClientOnly>
  );
}
