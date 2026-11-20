import "server-only";

/**
 * Transactional email. Uses Resend's HTTP API when RESEND_API_KEY and
 * EMAIL_FROM are configured; otherwise the message is only logged, so the
 * app keeps working in development and before email is set up.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: OutgoingEmail): Promise<boolean> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:dev] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`);
    } else {
      console.warn("[email] RESEND_API_KEY / EMAIL_FROM are not configured; email was not sent.");
    }
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[email] provider rejected the message:", response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

/** The configured public base URL (APP_URL, or the Vercel production domain), if any. */
export function configuredAppBaseUrl(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

/**
 * Base URL for links an admin sees and hands over. Falls back to the admin's
 * own request origin, which only that signed-in admin controls.
 */
export function appBaseUrl(requestOrigin?: string): string {
  return configuredAppBaseUrl() || requestOrigin || "http://localhost:3000";
}

/**
 * Base URL for links sent by email to whoever owns an address. In production
 * it is never taken from the request: anyone can send a request with a forged
 * Host header, and the emailed link would then point at their site.
 */
export function emailLinkBaseUrl(requestOrigin?: string): string | null {
  const configured = configuredAppBaseUrl();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : requestOrigin || "http://localhost:3000";
}
