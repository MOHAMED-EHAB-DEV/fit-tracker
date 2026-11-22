import React from "react";
import Link from "next/link";
import { Check, Download, Plus } from "lucide-react";
import { Wordmark } from "@/components/shared/BrandMark";
import { SessionVignette, TodayVignette, WidgetsVignette } from "@/components/marketing/Vignettes";
import { FAQ, FEATURES, GYM_FLOOR_FACTS, PRICE_LINE, TRUST_POINTS } from "@/components/marketing/content";
import { buttonClasses } from "@/components/ui/button-styles";
import { ANDROID_RELEASES_URL } from "@/services/webview-bridge";
import { cn } from "@/lib/utils";

const CONTAINER = "mx-auto w-full max-w-[1120px] px-4 md:px-6";
const SECTION = "border-t border-line py-12 md:py-[72px]";

/** Landing-page call-to-action buttons (links), a touch larger than in-app controls. */
const CTA_PRIMARY = buttonClasses({ size: "md", className: "min-h-[46px] px-5" });
const CTA_SECONDARY = buttonClasses({ variant: "secondary", size: "md", className: "min-h-[46px] px-[18px]" });

function AndroidLink({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <a href={ANDROID_RELEASES_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function SectionHeading({ label, title, sub }: { label: string; title: string; sub?: string }) {
  return (
    <div className="mb-11 max-w-[600px]">
      <span className="mb-2 block text-[13px] font-medium text-accent">{label}</span>
      <h2 className="text-[clamp(24px,3vw,32px)] leading-[1.18] font-semibold tracking-[-0.025em]">{title}</h2>
      {sub && <p className="mt-2.5 text-[15px] text-ink-2">{sub}</p>}
    </div>
  );
}

export function Hero() {
  return (
    <section className="pt-8 pb-11 md:pt-14 md:pb-16">
      <div className={CONTAINER}>
        <div className="max-w-[660px]">
          <h1 className="text-[clamp(32px,4.4vw,48px)] leading-[1.1] font-semibold tracking-[-0.03em]">
            A personal fitness tracker built like an instrument.
          </h1>
          <p className="mt-4 max-w-[580px] text-[clamp(16px,1.8vw,18px)] leading-normal text-ink-2">
            Log sets in one tap, see calories left for the day, and keep your plan, habits and body trends in one calm
            workspace.
          </p>
          <div className="mt-[26px] flex flex-wrap items-center gap-x-3 gap-y-2.5">
            <Link href="/signup" className={CTA_PRIMARY}>
              Get started
            </Link>
            <Link href="/login" className={CTA_SECONDARY}>
              Sign in
            </Link>
          </div>
          <p className="mt-4 max-w-[580px] text-sm leading-5 text-ink-2">{PRICE_LINE}</p>
          <p className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-ink-3">
            <span>Installable web app (PWA)</span>
            <span aria-hidden="true">·</span>
            <AndroidLink className="border-b border-line-strong pb-px text-ink-2 transition-colors hover:text-ink">
              Get the Android app
            </AndroidLink>
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 min-[900px]:grid-cols-[1fr_1.08fr] min-[900px]:gap-5">
          <TodayVignette />
          <SessionVignette />
        </div>
      </div>
    </section>
  );
}

export function GymFloorFacts() {
  return (
    <section aria-label="Built for the gym floor" className="border-t border-line py-11">
      <div className={CONTAINER}>
        <div className="grid overflow-hidden rounded-card border border-line bg-surface min-[900px]:grid-cols-3">
          {GYM_FLOOR_FACTS.map((fact, index) => (
            <div
              key={fact.title}
              className={cn(
                "flex flex-col gap-2 p-[22px]",
                index > 0 && "border-t border-line min-[900px]:border-t-0 min-[900px]:border-s"
              )}
            >
              <span className="font-mono text-xs font-semibold text-accent">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="text-base font-semibold tracking-[-0.01em]">{fact.title}</h2>
              <p className="text-sm text-ink-2">{fact.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section id="features" className={cn(SECTION, "scroll-mt-16")}>
      <div className={CONTAINER}>
        <SectionHeading
          label="One job per screen"
          title="Five focused spaces, one shared visual grammar."
          sub="Training, nutrition, your day, body check-ins and Coach each keep one main action in front of you."
        />
        <div className="flex flex-col gap-14">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.id}
              className="grid items-center gap-6 min-[900px]:grid-cols-[1fr_1.08fr] min-[900px]:gap-12"
            >
              <div className={cn("flex flex-col gap-3", index % 2 === 1 && "min-[900px]:order-2")}>
                <span className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-ink-2">
                  <span aria-hidden="true">{feature.icon}</span>
                  {feature.kicker}
                </span>
                <h3 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.02em]">{feature.title}</h3>
                <p className="text-[15px] text-ink-2">{feature.body}</p>
                <ul className="mt-1 flex flex-col gap-1.5 text-sm text-ink-2">
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <Check className="h-[13px] w-[13px] shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              {feature.preview}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AndroidSection() {
  return (
    <section id="android" className={cn(SECTION, "scroll-mt-16")}>
      <div className={cn(CONTAINER, "grid items-center gap-6 min-[900px]:grid-cols-2 min-[900px]:gap-10")}>
        <div>
          <span className="mb-2 block text-[13px] font-medium text-accent">Web and Android</span>
          <h2 className="text-[clamp(24px,3vw,32px)] leading-[1.18] font-semibold tracking-[-0.025em]">
            Install it on the web, or add the Android tools.
          </h2>
          <p className="mt-2.5 text-[15px] text-ink-2">
            FitTracker runs as an installable web app (PWA). The Android app adds a step counter, home-screen widgets
            and planner reminders.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <AndroidLink className={CTA_PRIMARY}>
              <Download className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden="true" />
              Get the Android app
            </AndroidLink>
            <Link href="/signup" className={CTA_SECONDARY}>
              Get started on the web
            </Link>
          </div>
        </div>
        <WidgetsVignette />
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section aria-label="Privacy and ownership" className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading label="Ownership" title="Your data stays yours." />
        <div className="grid gap-3.5 sm:grid-cols-2 min-[900px]:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="flex flex-col gap-[9px] rounded-card border border-line bg-surface p-5">
              <span
                aria-hidden="true"
                className="grid h-[34px] w-[34px] place-items-center rounded-chip border border-line bg-elevated text-ink"
              >
                {point.icon}
              </span>
              <h3 className="text-base font-semibold tracking-[-0.01em]">{point.title}</h3>
              <p className="text-sm text-ink-2">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className={cn(SECTION, "scroll-mt-16")}>
      <div className={CONTAINER}>
        <SectionHeading label="FAQ" title="Common questions." />
        <div className="max-w-[780px] divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {FAQ.map((item, index) => (
            <details key={item.question} className="group" open={index === 0}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <Plus
                  className="h-[15px] w-[15px] shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-45 group-open:text-accent"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-[660px] px-5 pb-[18px] text-sm text-ink-2">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={cn(SECTION, "pb-16")}>
      <div className={CONTAINER}>
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-card border border-line bg-surface px-5 py-[26px] md:px-8 md:py-10">
          <div>
            <h2 className="text-[clamp(24px,3vw,32px)] leading-[1.18] font-semibold tracking-[-0.025em]">
              Ready for your next session.
            </h2>
            <p className="mt-1.5 text-[15px] text-ink-2">Create an account on the web or install the Android app.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/signup" className={CTA_PRIMARY}>
              Get started
            </Link>
            <AndroidLink className={CTA_SECONDARY}>Get the Android app</AndroidLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line py-7 text-[13px] text-ink-3">
      <div className={cn(CONTAINER, "flex flex-wrap items-center justify-between gap-4")}>
        <Wordmark size={22} className="text-sm" />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <a href="#features" className="inline-flex min-h-11 items-center hover:text-ink">
            Features
          </a>
          <a href="#android" className="inline-flex min-h-11 items-center hover:text-ink">
            Android
          </a>
          <a href="#faq" className="inline-flex min-h-11 items-center hover:text-ink">
            FAQ
          </a>
          <Link href="/login" className="inline-flex min-h-11 items-center hover:text-ink">
            Sign in
          </Link>
          <Link href="/signup" className="inline-flex min-h-11 items-center hover:text-ink">
            Get started
          </Link>
        </nav>
      </div>
    </footer>
  );
}
