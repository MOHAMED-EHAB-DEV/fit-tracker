import type { NextConfig } from "next";

const OBJECT_ID = "[0-9a-fA-F]{24}";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app is never embedded in another site, and embeds nothing from other
  // sites: no frame from elsewhere can reach the Android app's JS bridge
  // (WebView exposes it to every frame), and no plugins load.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; frame-src 'self'; child-src 'self'; object-src 'none'; base-uri 'self'",
  },
  // The camera is used for meal and progress photos; nothing else is needed.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * `scripts/dev-local.mjs` builds into its own folder, so its throwaway setup
 * (placeholder keys baked into the bundle) never mixes with a real build in
 * `.next`, and it can run beside a normal `next dev`.
 */
const LOCAL_DIST_DIR = ".next-local";
const useLocalDistDir = process.env.FIT_TRACKER_DIST_DIR === LOCAL_DIST_DIR;

const nextConfig: NextConfig = {
  ...(useLocalDistDir ? { distDir: LOCAL_DIST_DIR } : {}),
  poweredByHeader: false,
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be re-checked, never served stale.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  async redirects() {
    // Addresses from before the workout system was rebuilt (bookmarks, the
    // Android app's shortcuts and old notifications) keep working.
    return [
      { source: "/workouts/new", destination: "/workouts", permanent: false },
      { source: "/workouts/record", destination: "/workouts", permanent: false },
      { source: "/workouts/templates", destination: "/workouts", permanent: false },
      { source: "/workouts/sessions", destination: "/workouts/history", permanent: false },
      { source: `/workouts/sessions/:id(${OBJECT_ID})`, destination: "/workouts/history/:id", permanent: false },
      { source: `/workouts/:id(${OBJECT_ID})/active`, destination: "/workouts/session/:id", permanent: false },
      { source: `/workouts/:id(${OBJECT_ID})`, destination: "/workouts/history/:id", permanent: false },
    ];
  },
};

export default nextConfig;
