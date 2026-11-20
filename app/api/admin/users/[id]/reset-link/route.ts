import { route, ok } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { appBaseUrl } from "@/lib/email";
import { RESET_LINK_MINUTES, createPasswordResetLink } from "@/lib/admin/users";

/**
 * Creates a one-time password reset link and returns it once, for the admin
 * to hand over when the app has no email provider. Creating a new link
 * replaces any earlier one.
 */
export const POST = route<undefined, undefined, { id: string }>(
  { auth: "admin", rateLimit: RATE_LIMITS.writePerMinute },
  async ({ request, params }) => {
    const result = await createPasswordResetLink(params.id, appBaseUrl(request.nextUrl.origin));
    return ok(
      { ...result, validMinutes: RESET_LINK_MINUTES },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
);
