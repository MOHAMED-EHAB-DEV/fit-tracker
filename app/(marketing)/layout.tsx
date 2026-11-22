import React from "react";

/** The public site: no app shell, Plex Sans at 15/1.55 for reading. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing-root min-h-dvh bg-canvas text-[15px] leading-[1.55] text-ink">{children}</div>;
}
