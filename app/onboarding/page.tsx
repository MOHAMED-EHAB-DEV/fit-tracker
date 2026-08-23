import { redirect } from "next/navigation";
import { getFullUser } from "@/lib/auth/session";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default async function OnboardingPage() {
  const user = await getFullUser();

  // 1. Unauthenticated visitors are redirected to /login
  if (!user) {
    redirect("/login");
  }

  // 2. Users who have already completed their profile are restricted and sent directly to /
  if (user.isProfileComplete) {
    redirect("/");
  }

  // 3. Only users with incomplete profiles are granted access to onboarding
  return <OnboardingFlow />;
}
