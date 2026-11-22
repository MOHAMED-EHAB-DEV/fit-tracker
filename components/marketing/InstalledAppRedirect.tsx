"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isInstalledAppContext, SIGN_IN_PATH } from "@/lib/ui/landing";

/**
 * Inside the installed PWA or the Android app, a signed-out person who
 * reaches the landing page by a client-side navigation goes to sign-in.
 * (Full page loads are handled before paint by the script in app/layout.tsx.)
 */
export function InstalledAppRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (isInstalledAppContext()) router.replace(SIGN_IN_PATH);
  }, [router]);
  return null;
}

export default InstalledAppRedirect;
