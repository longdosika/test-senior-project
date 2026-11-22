export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "senior-project-token";

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Session token kept per browser. Storage may be blocked, in which case the user simply stays logged out. */
export function getStoredToken(): string | null {
  try {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) storage()?.setItem(TOKEN_KEY, token);
    else storage()?.removeItem(TOKEN_KEY);
  } catch {
    // ignore: storage unavailable
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string | null; json?: unknown } = {},
): Promise<T> {
  const { token, json, headers: rawHeaders, ...init } = opts;
  const headers = new Headers(rawHeaders);
  let body = init.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }
  const bearer = token ?? getStoredToken();
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, body });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export function realtimeUrl(): string {
  return `${API_BASE.replace(/^http/, "ws")}/ws`;
}
