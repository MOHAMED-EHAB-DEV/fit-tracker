import { NextRequest, NextResponse } from "next/server";
import { apiCache, invalidateApiCache, invalidateCacheByTag } from "./cache";
import {
  rateLimiter,
  RateLimitOptions,
  getClientIdentifier,
  formatRateLimitHeaders,
} from "./rate-limit";

export interface CacheConfig {
  enabled?: boolean;
  ttlMs?: number; // Time to live in ms (default: 60,000ms = 60s)
  scope?: "user" | "global"; // "user" (default) keys by user/client; "global" shares across all users
  tags?: string[]; // Cache tags for bulk invalidation
  keyGenerator?: (req: NextRequest) => string | Promise<string>;
  bypassHeader?: string; // Custom header to bypass cache (e.g. "x-bypass-cache")
  shouldCache?: (req: NextRequest, res: Response | NextResponse) => boolean;
}

export interface ApiMiddlewareOptions {
  /**
   * Route name / identifier used as namespace for caching and rate limiting
   * e.g. "exercises", "workout-templates"
   */
  routeName?: string;

  /**
   * Cache tags for grouping, tagging, or bulk mutation invalidation
   * e.g. ["exercises", "workouts"]
   */
  tags?: string[];

  /**
   * Rate limiting options:
   * - boolean: `true` (default 60 req/min) or `false` (disabled)
   * - object: `{ enabled, limit, windowMs, keyGenerator }`
   */
  rateLimit?: boolean | RateLimitOptions;

  /**
   * In-Memory Cache options:
   * - boolean: `true` (default 60s TTL) or `false` (disabled)
   * - object: `{ enabled, ttlMs, scope, tags, keyGenerator, ... }`
   */
  cache?: boolean | CacheConfig;

  /**
   * Automatically invalidate cache tags or routeName on successful POST/PUT/PATCH/DELETE
   * Default: true
   */
  autoInvalidateOnMutation?: boolean;

  /**
   * Wrap execution in try/catch and return standardized JSON error on unhandled exception
   * Default: true
   */
  handleErrors?: boolean;
}

type RouteHandler<TContext = unknown> = (
  request: NextRequest,
  context: TContext
) => Promise<NextResponse | Response> | NextResponse | Response;

/**
 * Generate a canonical cache key from the request URL, query parameters, and client scope
 */
export function generateRequestCacheKey(
  request: NextRequest,
  options?: { routeName?: string; scope?: "user" | "global" }
): string {
  const url = new URL(request.url);
  const route = options?.routeName || url.pathname;
  const scope = options?.scope ?? "user";

  // Sort query parameters for deterministic cache keys
  const sortedParams = Array.from(url.searchParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const queryPart = sortedParams ? `?${sortedParams}` : "";

  if (scope === "global") {
    return `cache:global:${route}${queryPart}`;
  }

  const clientId = getClientIdentifier(request);
  return `cache:${clientId}:${route}${queryPart}`;
}

/**
 * Unified Higher-Order API Middleware wrapper for Next.js App Router Route Handlers.
 * Handles rate limiting (toggle, custom ttl & max requests), fast in-memory map caching,
 * automatic mutation cache invalidation, and error handling entirely configured via props.
 */
export function withAPIMiddleware<TContext = unknown>(
  handler: RouteHandler<TContext>,
  options?: ApiMiddlewareOptions
): (request: NextRequest, context: TContext) => Promise<NextResponse | Response> {
  const routeName = options?.routeName || "api";
  const handleErrors = options?.handleErrors ?? true;
  const autoInvalidate = options?.autoInvalidateOnMutation ?? true;

  // Rate limit config
  const rateLimitOpt = options?.rateLimit;
  const isRateLimitDisabled =
    rateLimitOpt === false || (typeof rateLimitOpt === "object" && rateLimitOpt.enabled === false);
  const rateLimitLimit = typeof rateLimitOpt === "object" ? rateLimitOpt.limit : undefined;
  const rateLimitWindowMs = typeof rateLimitOpt === "object" ? rateLimitOpt.windowMs : undefined;

  // Cache config
  const cacheOpt = options?.cache;
  const isCacheEnabled =
    cacheOpt === true || (typeof cacheOpt === "object" && cacheOpt.enabled !== false);
  const cacheTtlMs = typeof cacheOpt === "object" ? cacheOpt.ttlMs : undefined;
  const cacheScope = typeof cacheOpt === "object" ? cacheOpt.scope : "user";
  const cacheTags = options?.tags || (typeof cacheOpt === "object" ? cacheOpt.tags : undefined);
  const bypassHeader = typeof cacheOpt === "object" ? cacheOpt.bypassHeader : undefined;

  return async (request: NextRequest, context: TContext): Promise<NextResponse | Response> => {
    const method = request.method.toUpperCase();
    const startTime = Date.now();

    // 1. Rate Limiting Check
    let rateLimitHeaders: Record<string, string> = {};
    if (!isRateLimitDisabled) {
      const clientId =
        typeof rateLimitOpt === "object" && rateLimitOpt.keyGenerator
          ? await rateLimitOpt.keyGenerator(request)
          : `${routeName}:${getClientIdentifier(request)}`;

      const limitResult = rateLimiter.check(clientId, rateLimitLimit, rateLimitWindowMs);
      rateLimitHeaders = formatRateLimitHeaders(limitResult);

      if (!limitResult.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "Too many requests. Please slow down and try again.",
            retryAfterSeconds: limitResult.retryAfter,
          },
          {
            status: 429,
            headers: rateLimitHeaders,
          }
        );
      }
    }

    // 2. In-Memory Cache Lookup (GET requests only)
    let cacheKey = "";
    const isBypassRequested =
      request.headers.get("cache-control")?.includes("no-cache") ||
      (bypassHeader && request.headers.get(bypassHeader) === "true") ||
      request.nextUrl.searchParams.get("bypassCache") === "true";

    if (method === "GET" && isCacheEnabled && !isBypassRequested) {
      cacheKey =
        typeof cacheOpt === "object" && cacheOpt.keyGenerator
          ? await cacheOpt.keyGenerator(request)
          : generateRequestCacheKey(request, { routeName, scope: cacheScope });

      const cached = apiCache.get(cacheKey);
      if (cached) {
        const responseHeaders = new Headers({
          ...cached.headers,
          ...rateLimitHeaders,
          "X-Cache": "HIT",
          "X-Cache-Remaining-TTL": `${Math.max(0, cached.expiresAt - Date.now())}ms`,
          "X-Response-Time": `${Date.now() - startTime}ms`,
        });

        return NextResponse.json(cached.data, {
          status: cached.status,
          headers: responseHeaders,
        });
      }
    }

    // 3. Execute Route Handler
    try {
      const response = await handler(request, context);

      // 4. Invalidation on Mutation (POST, PUT, PATCH, DELETE)
      if (
        autoInvalidate &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        response.status >= 200 &&
        response.status < 300
      ) {
        // Invalidate tags if specified
        if (cacheTags && cacheTags.length > 0) {
          for (const tag of cacheTags) {
            invalidateCacheByTag(tag);
          }
        }
        // Invalidate route namespace
        if (routeName && routeName !== "api") {
          invalidateApiCache(new RegExp(`:${routeName}(\\?|:|$)`));
        }
      }

      // 5. Store in Cache if eligible (GET 200-299)
      if (
        method === "GET" &&
        isCacheEnabled &&
        cacheKey &&
        response.status >= 200 &&
        response.status < 300
      ) {
        const shouldCache =
          typeof cacheOpt === "object" && cacheOpt.shouldCache
            ? cacheOpt.shouldCache(request, response)
            : true;

        if (shouldCache) {
          try {
            // Clone response to read body without consuming original
            const cloned = response.clone();
            const data = await cloned.json().catch(() => null);

            if (data !== null) {
              const tags = [...(cacheTags || [])];
              if (routeName) tags.push(routeName);

              apiCache.set(cacheKey, data, {
                ttlMs: cacheTtlMs,
                status: response.status,
                tags,
              });
            }
          } catch {
            // If body is not JSON or cloning fails, skip caching silently
          }
        }
      }

      // Decorate outgoing response with rate-limit and cache diagnostic headers
      const decoratedHeaders = new Headers(response.headers);
      for (const [key, value] of Object.entries(rateLimitHeaders)) {
        decoratedHeaders.set(key, value);
      }
      if (method === "GET" && isCacheEnabled) {
        decoratedHeaders.set("X-Cache", "MISS");
      }
      decoratedHeaders.set("X-Response-Time", `${Date.now() - startTime}ms`);

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: decoratedHeaders,
      });
    } catch (err: unknown) {
      if (!handleErrors) throw err;

      const errorMessage = err instanceof Error ? err.message : "Internal server error";
      console.error(`[API Middleware Error] ${method} ${routeName}:`, err);
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        {
          status: 500,
          headers: rateLimitHeaders,
        }
      );
    }
  };
}
