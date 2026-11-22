import { randomBytes } from "node:crypto";

/** Shared E2E constants. The admin email must match ADMIN_EMAILS in playwright.config.ts. */
export const API_URL = "http://localhost:4000";
export const PASSWORD = "e2e-correct-horse";
export const ADMIN_EMAIL = "admin@e2e.test";
export const ADMIN_NAME = "E2E Admin";
export const QUIZ_TITLE = "E2E quiz: agile basics";

/** A fresh email per test so flows never collide, even when the API database is reused. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomBytes(4).toString("hex")}@e2e.test`;
}

/** Calls the API directly (setup only; the flows themselves go through the UI). */
export async function apiJson(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init.cookie ? { Cookie: init.cookie } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = res.status === 204 ? undefined : await res.json();
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}

/** Registers (or logs in) through the API and returns the session cookie for later setup calls. */
export async function sessionFor(email: string, displayName: string): Promise<{ cookie: string; userId: string }> {
  const reg = await apiJson("/api/auth/register", { method: "POST", body: { email, password: PASSWORD, displayName } });
  const res =
    reg.status === 201
      ? reg
      : await apiJson("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  if (!res.setCookie) throw new Error(`no session cookie for ${email} (status ${res.status})`);
  return { cookie: res.setCookie.split(";")[0], userId: res.data.user.id as string };
}
