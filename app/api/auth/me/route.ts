import { getClientUser } from "@/lib/auth/session";
import { ok, fail, errorResponse } from "@/lib/api/route";

export async function GET() {
  try {
    const user = await getClientUser();
    if (!user) return fail(401, "Unauthorized");
    return ok({ user });
  } catch (err) {
    return errorResponse(err, "GET /api/auth/me");
  }
}
