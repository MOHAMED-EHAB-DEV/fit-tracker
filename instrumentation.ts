import type { Instrumentation } from "next";

/**
 * Server error logging. Next.js calls this for every error it captures while
 * rendering a page, running a route handler, a server action or the proxy.
 *
 * One JSON line per error, so the hosting log search (Vercel, or any log
 * collector) can filter on it. Deliberately left out: request headers
 * (cookies, tokens) and the query string (reset links carry a token there).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error instanceof Error ? error : null;
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      source: "next.onRequestError",
      message: err ? err.message : String(error),
      name: err?.name,
      digest,
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      // Server logs only; never sent to the browser.
      stack: err?.stack,
      at: new Date().toISOString(),
    })
  );
};
