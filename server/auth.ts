import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Hashes a password with scrypt. Format: scrypt$<salt b64>$<key b64>. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Opaque session token handed to the client in an httpOnly cookie. Only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_COOKIE = "sp_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns one cookie's value from a raw Cookie header, or null when absent or malformed.
 * Kept dependency-free so the parsing rules are easy to test.
 */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Set-Cookie value for the session. HttpOnly keeps it away from page scripts;
 * SameSite=Lax stops browsers sending it on cross-site POSTs (basic CSRF defence).
 * Secure is set in production so the cookie only travels over HTTPS.
 */
function cookieAttributes(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function sessionCookie(token: string, opts: { secure: boolean; maxAgeMs?: number }): string {
  const maxAge = Math.floor((opts.maxAgeMs ?? SESSION_TTL_MS) / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; ${cookieAttributes(opts.secure)}`;
}

/** Set-Cookie value that removes the session cookie from the browser. */
export function clearSessionCookie(opts: { secure: boolean }): string {
  return `${SESSION_COOKIE}=; Max-Age=0; ${cookieAttributes(opts.secure)}`;
}
