/**
 * Errors whose message is safe to show to the user. Kept free of framework
 * imports so services and tests can use it anywhere.
 */
export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new HttpError(429, "Too many requests. Please slow down and try again shortly.", { retryAfterSeconds });
