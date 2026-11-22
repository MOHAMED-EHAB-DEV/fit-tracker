import React from "react";
import Link from "next/link";
import { Wordmark } from "@/components/shared/BrandMark";
import { ThemeSwitch } from "@/components/marketing/ThemeSwitch";
import { buttonClasses } from "@/components/ui/button-styles";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#android", label: "Android" },
  { href: "#faq", label: "FAQ" },
];

/** Sticky glass header of the public site. */
export function SiteHeader() {
  return (
    <header className="glass-chrome-top sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[62px] w-full max-w-[1120px] items-center justify-between gap-2 px-4 md:gap-4 md:px-6">
        <Link href="/" aria-label="FitTracker home" className="flex min-h-11 items-center rounded-control">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-[26px] text-sm text-ink-2 md:flex">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 md:gap-2.5">
          <ThemeSwitch />
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center whitespace-nowrap px-1 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink md:px-2"
          >
            Sign in
          </Link>
          <Link href="/signup" className={buttonClasses({ size: "sm", className: "whitespace-nowrap" })}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
