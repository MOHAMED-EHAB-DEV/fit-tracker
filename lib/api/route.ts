import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z, type ZodType } from "zod";
import { getServerSession, type SessionUser } from "@/lib/auth/session";
import { clientIp, enforceRateLimit, type RateLimitRule } from "@/lib/security/rate-limit";
import { HttpError, badRequest, forbidden, unauthorized } from "@/lib/api/errors";

export { HttpError, badRequest, conflict, forbidden, notFound, unauthorized } from "@/lib/api/errors";
export { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Shared plumbing for Route Handlers: authentication against the database,
 * rate limiting, input validation and safe error responses.
 *
 *   export const POST = route({ body: schema }, async ({ session, body }) => ok({ ... }));
 */

export function ok<T extends Record<string, unknown>>(data?: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, ...(data || {}) }, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: false, error: message, ...(extra || {}) }, { status });
}

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Turns any thrown value into a response without leaking internals. */
export function errorResponse(err: unknown, context: string = "api"): NextResponse {
  if (err instanceof HttpError) {
    return fail(err.status, err.message, err.details ? { details: err.details } : undefined);
  }
  if (err instanceof z.ZodError) {
    return fail(400, describeZodError(err));
  }
  const named = err as { name?: string; code?: number; message?: string };
  if (named?.name === "CastError") return fail(400, "Invalid identifier or value");
  if (named?.name === "ValidationError") return fail(400, "Some of the submitted values are not valid");
  if (named?.code === 11000) return fail(409, "This already exists");
  if (err instanceof SyntaxError) return fail(400, "Invalid request body");

  console.error(`[${context}]`, err);
  return fail(500, GENERIC_ERROR);
}

/** A message safe to show for an unknown error (never raw internals). */
export function publicErrorMessage(err: unknown): string {
  return err instanceof HttpError ? err.message : GENERIC_ERROR;
}

export function describeZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

/** Rejects keys that MongoDB would treat as operators or paths. */
export function assertNoMongoOperators(value: unknown, depth: number = 0): void {
  if (depth > 12) throw badRequest("Request body is nested too deeply");
  if (Array.isArray(value)) {
    for (const item of value) assertNoMongoOperators(item, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("$") || key.includes("\u0000")) {
        throw badRequest("Request body contains a field name that is not allowed");
      }
      assertNoMongoOperators(child, depth + 1);
    }
  }
}

const DEFAULT_MAX_JSON_BYTES = 512 * 1024;

/** Reads and sanity-checks a JSON request body. */
export async function readJson(request: Request, maxBytes: number = DEFAULT_MAX_JSON_BYTES): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "Request body is too large");
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request body is too large");
  if (!text.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw badRequest("Invalid request body");
  }
  assertNoMongoOperators(parsed);
  return parsed;
}

export function parseWith<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw badRequest(describeZodError(result.error));
  return result.data;
}

interface RouteOptions<TBody, TQuery> {
  /** "user" (default): any signed-in user. "admin": admins only. */
  auth?: "user" | "admin";
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  rateLimit?: RateLimitRule;
  maxBodyBytes?: number;
}

interface RouteContext<TBody, TQuery, TParams> {
  request: NextRequest;
  session: SessionUser;
  body: TBody;
  query: TQuery;
  params: TParams;
}

type NextRouteHandler<TParams> = (
  request: NextRequest,
  context: { params: Promise<TParams> }
) => Promise<Response>;

function queryToObject(request: NextRequest): Record<string, string> {
  const result: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/** An authenticated Route Handler. */
export function route<TBody = undefined, TQuery = undefined, TParams = Record<string, string>>(
  options: RouteOptions<TBody, TQuery>,
  handler: (context: RouteContext<TBody, TQuery, TParams>) => Promise<Response>
): NextRouteHandler<TParams> {
  return async (request, context) => {
    try {
      const session = await getServerSession();
      if (!session) throw unauthorized();
      if (options.auth === "admin" && session.role !== "admin") throw forbidden("Admin access required");

      if (options.rateLimit) await enforceRateLimit(options.rateLimit, session.userId);

      const params = ((await context?.params) || {}) as TParams;
      const query = (options.query ? parseWith(options.query, queryToObject(request)) : undefined) as TQuery;
      const body = (
        options.body ? parseWith(options.body, await readJson(request, options.maxBodyBytes)) : undefined
      ) as TBody;

      return await handler({ request, session, body, query, params });
    } catch (err) {
      return errorResponse(err, `${request.method} ${request.nextUrl.pathname}`);
    }
  };
}

interface PublicRouteOptions<TBody> {
  body?: ZodType<TBody>;
  /** Applied per client IP. */
  rateLimit?: RateLimitRule;
  maxBodyBytes?: number;
}

/** A Route Handler that does not require a session (login, signup, ...). */
export function publicRoute<TBody = undefined>(
  options: PublicRouteOptions<TBody>,
  handler: (context: { request: NextRequest; body: TBody }) => Promise<Response>
): NextRouteHandler<Record<string, string>> {
  return async (request) => {
    try {
      if (options.rateLimit) await enforceRateLimit(options.rateLimit, clientIp(request));
      const body = (
        options.body ? parseWith(options.body, await readJson(request, options.maxBodyBytes)) : undefined
      ) as TBody;
      return await handler({ request, body });
    } catch (err) {
      return errorResponse(err, `${request.method} ${request.nextUrl.pathname}`);
    }
  };
}
