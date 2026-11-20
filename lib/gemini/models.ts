/**
 * Which Gemini models each kind of AI request uses, in order of preference.
 *
 * The server picks the model. Users cannot choose one: the key is usually a
 * free-tier key, and a free key only reaches some of these models. When a
 * model is not available to the key (paid-only, quota used up, overloaded),
 * the request moves on to the next model in the list.
 *
 * Free-tier availability on Google's pricing page, checked 2026-11-20:
 *   gemini-4-argon         paid tier only
 *   gemini-4-neon          paid tier only
 *   gemini-4-hydrogen      free
 *   gemini-3.8-flash       free
 *   gemini-3.5-flash-lite  free
 */
export const GEMINI_MODELS = {
  argon: "gemini-4-argon",
  neon: "gemini-4-neon",
  hydrogen: "gemini-4-hydrogen",
  flash: "gemini-3.8-flash",
  flashLite: "gemini-3.5-flash-lite",
} as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

/**
 * - "fast": quick structured jobs (meal analysis, day planning).
 * - "bodyComp": body-composition estimates from photos.
 * - "chat": the coach conversation.
 */
export type AiTask = "fast" | "bodyComp" | "chat";

export const MODEL_CHAINS: Record<AiTask, readonly GeminiModelId[]> = {
  fast: [GEMINI_MODELS.hydrogen, GEMINI_MODELS.flash],
  bodyComp: [GEMINI_MODELS.neon, GEMINI_MODELS.hydrogen, GEMINI_MODELS.flash],
  chat: [
    GEMINI_MODELS.argon,
    GEMINI_MODELS.neon,
    GEMINI_MODELS.hydrogen,
    GEMINI_MODELS.flash,
    GEMINI_MODELS.flashLite,
  ],
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function errorStatus(err: unknown): number {
  const source = err as { status?: unknown; statusCode?: unknown; code?: unknown } | null;
  const status = Number(source?.status ?? source?.statusCode ?? source?.code);
  return Number.isFinite(status) ? status : 0;
}

function errorText(err: unknown): string {
  return String((err as { message?: unknown } | null)?.message ?? err ?? "").toLowerCase();
}

/** A rejected API key fails the same way on every model, so trying the next one is pointless. */
export function isInvalidKeyError(err: unknown): boolean {
  const text = errorText(err);
  return (
    errorStatus(err) === 401 ||
    text.includes("api key not valid") ||
    text.includes("api_key_invalid") ||
    text.includes("invalid api key") ||
    text.includes("api key expired")
  );
}

/** Whether a failed attempt should move on to the next model in the chain. */
export function shouldTryNextModel(err: unknown): boolean {
  return !isInvalidKeyError(err);
}

/**
 * How long to skip a model for this key after a failure, in milliseconds.
 * A model the key cannot use at all (paid-only, unknown) is skipped for
 * hours, so later requests do not pay for a doomed first attempt. A used-up
 * per-minute quota is skipped for a minute. Other failures are not remembered.
 */
export function modelCooldownMs(err: unknown): number {
  if (isInvalidKeyError(err)) return 0;
  const status = errorStatus(err);
  const text = errorText(err);
  if (status === 403 || status === 404 || text.includes("permission_denied") || text.includes("not_found")) {
    return SIX_HOURS_MS;
  }
  if (status === 429 || text.includes("resource_exhausted") || text.includes("quota")) {
    // "limit: 0" is how the API reports a model with no free-tier quota at all.
    if (/limit:\s*0\b/.test(text) || text.includes("free tier") || text.includes("free_tier")) return SIX_HOURS_MS;
    return ONE_MINUTE_MS;
  }
  return 0;
}

/**
 * The models to try for one request: the chain minus models on cooldown.
 * If every model is on cooldown, the last (most available) one is still tried.
 */
export function modelsToTry(
  chain: readonly GeminiModelId[],
  isCoolingDown: (model: GeminiModelId) => boolean
): GeminiModelId[] {
  const available = chain.filter((model) => !isCoolingDown(model));
  return available.length > 0 ? available : chain.slice(-1);
}
