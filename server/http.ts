/** Error with an HTTP status; the global error handler turns it into JSON. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function requireBody(body: unknown): Record<string, unknown> {
  if (body === undefined || body === null) return {};
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "JSON object body required");
  }
  return body as Record<string, unknown>;
}

export function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return trimmed;
}

export function requiredString(value: unknown, field: string, max: number): string {
  const v = optionalString(value, field, max);
  if (!v) throw new HttpError(400, `${field} is required`);
  return v;
}

export function optionalInt(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, `${field} must be an integer`);
  }
  if (value < min || value > max) throw new HttpError(400, `${field} must be between ${min} and ${max}`);
  return value;
}

export function parseQueryInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "string" || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `query value must be an integer between ${min} and ${max}`);
  }
  return n;
}
