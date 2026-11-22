import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/ui/brand";

export const alt = "FitTracker — a personal fitness tracker built like an instrument";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share image for the landing page: the mark, the promise, a calibrated track. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BRAND.canvas,
          color: BRAND.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 96 96">
            <rect width="96" height="96" rx="22" fill={BRAND.carbon} />
            <rect x="16" y="30" width="7" height="24" rx="2.5" fill={BRAND.graphite} />
            <rect x="26" y="22" width="10" height="40" rx="3" fill={BRAND.steel} />
            <rect x="36" y="39" width="24" height="6" fill={BRAND.steel} />
            <rect x="60" y="22" width="10" height="40" rx="3" fill={BRAND.steel} />
            <rect x="73" y="30" width="7" height="24" rx="2.5" fill={BRAND.graphite} />
            <rect x="46.5" y="36" width="3" height="12" rx="1.5" fill={BRAND.accent} />
            <rect x="20" y="72" width="56" height="5" rx="2.5" fill={BRAND.track} />
            <rect x="20" y="72" width="38" height="5" rx="2.5" fill={BRAND.accent} />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>FitTracker</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.03em", maxWidth: 940 }}>
            A personal fitness tracker built like an instrument.
          </div>
          <div style={{ fontSize: 30, color: BRAND.ink2, maxWidth: 900 }}>
            Training, meals, your day and body trends. Free on the web and Android.
          </div>
        </div>

        <div style={{ display: "flex", height: 10, borderRadius: 5, background: BRAND.line, overflow: "hidden" }}>
          <div style={{ width: "68%", height: "100%", background: BRAND.accent }} />
        </div>
      </div>
    ),
    size
  );
}
