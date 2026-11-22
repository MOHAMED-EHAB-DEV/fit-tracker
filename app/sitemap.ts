import type { MetadataRoute } from "next";
import { configuredAppBaseUrl } from "@/lib/email";

/** One public page: the landing page. Needs APP_URL (or Vercel's production URL) for absolute links. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = configuredAppBaseUrl();
  if (!base) return [];
  return [{ url: `${base}/`, changeFrequency: "monthly", priority: 1 }];
}
