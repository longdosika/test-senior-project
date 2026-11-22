export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type SessionUser = { id: string; email: string; displayName: string; role: "admin" | "user" };

/**
 * Calls the API. The session is an httpOnly cookie set by the server, so this code never
 * reads or stores a token; `credentials: "include"` makes the browser send the cookie.
 */
export async function apiFetch<T>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers: rawHeaders, ...init } = opts;
  const headers = new Headers(rawHeaders);
  let body = init.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

/** The signed-in user, or null when there is no valid session. Other failures are rethrown. */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    return (await apiFetch<{ user: SessionUser }>("/api/auth/me")).user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function realtimeUrl(): string {
  return `${API_BASE.replace(/^http/, "ws")}/ws`;
}
