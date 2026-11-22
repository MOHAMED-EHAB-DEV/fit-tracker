import type { MetadataRoute } from "next";
import { configuredAppBaseUrl } from "@/lib/email";

/** Only the landing page is public; the signed-in app is not for crawlers. */
const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/dashboard",
  "/workouts",
  "/nutrition",
  "/planner",
  "/habits",
  "/body-comp",
  "/coach",
  "/settings",
  "/widgets",
  "/onboarding",
];

export default function robots(): MetadataRoute.Robots {
  const base = configuredAppBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
