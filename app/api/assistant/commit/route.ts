import { ok, route } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { commitRequestSchema } from "@/lib/validation/assistant";
import { commitProposal } from "@/lib/assistant/commit";

/**
 * Logs one entry the user confirmed in the AI Coach (meal, water, steps or
 * weight). This is the only assistant endpoint that writes data.
 * Retrying with the same `commitId` never logs twice.
 */
export const POST = route(
  { body: commitRequestSchema, rateLimit: RATE_LIMITS.writePerMinute, maxBodyBytes: 16 * 1024 },
  async ({ session, body }) => {
    const result = await commitProposal(session.userId, session.timezone, body);
    return ok({ ...result });
  }
);
