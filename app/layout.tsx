import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { configuredAppBaseUrl } from "@/lib/email";
import { THEME_COLORS, THEME_INIT_SCRIPT } from "@/lib/ui/theme";
import { LANDING_APP_REDIRECT_SCRIPT } from "@/lib/ui/landing";
import "./globals.css";

// Every word: IBM Plex Sans (variable). Numerals that tick or align: IBM Plex Mono.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const siteUrl = configuredAppBaseUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: {
    default: "FitTracker",
    // Pages give a short name ("Train"); the brand is added once, here.
    template: "%s · FitTracker",
  },
  description: "Track workouts, nutrition, habits and body composition in one place.",
  manifest: "/manifest.json",
  applicationName: "FitTracker",
  appleWebApp: { capable: true, title: "FitTracker", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // The app itself is private. The public landing page (app/(marketing))
  // opts back in to indexing.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Before the theme script runs (and without JavaScript) the system decides.
  // The script then adds a theme-color that matches the chosen theme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Pinch-zoom stays enabled. The on-screen keyboard resizes the page so
  // sheets and their buttons stay above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set by the script below before React hydrates.
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before the first paint so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* The installed app opens at "/": a signed-out person there gets sign-in, not the landing page. */}
        <script dangerouslySetInnerHTML={{ __html: LANDING_APP_REDIRECT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
