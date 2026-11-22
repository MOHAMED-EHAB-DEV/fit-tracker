import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { InstalledAppRedirect } from "@/components/marketing/InstalledAppRedirect";
import {
  AndroidSection,
  FaqSection,
  Features,
  FinalCta,
  GymFloorFacts,
  Hero,
  SiteFooter,
  TrustSection,
} from "@/components/marketing/Sections";

const TITLE = "FitTracker — a personal fitness tracker built like an instrument";
const DESCRIPTION =
  "Log sets in one tap, see calories left for the day, and keep your plan, habits and body trends in one calm workspace. Free to use, on the web and Android.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // The only public, indexed page (the app itself stays noindex).
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "FitTracker",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/**
 * The public landing page. Server-rendered: it works without JavaScript; the
 * only client code is the theme switch and the installed-app redirect.
 */
export default function LandingPage() {
  return (
    <>
      <InstalledAppRedirect />
      <SiteHeader />
      <main id="main">
        <Hero />
        <GymFloorFacts />
        <Features />
        <AndroidSection />
        <TrustSection />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
