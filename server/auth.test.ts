import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  clearSessionCookie,
  hashPassword,
  readCookie,
  sessionCookie,
  verifyPassword,
} from "./auth";
import { createTestApp, sessionCookieHeader, sessionTokenFromResponse } from "./testing/harness";

/**
 * Authentication behaviour: registration (สมัคร), login (เข้าสู่ระบบ), logout (ออกจากระบบ),
 * session expiry (token หมดอายุ) and admin authorisation (สิทธิ์ admin).
 * Sessions are httpOnly cookies, so these tests read and send the Set-Cookie / Cookie headers.
 */

type Ctx = Awaited<ReturnType<typeof createTestApp>>;
const PASSWORD = "correct-horse-battery";
const ADMIN_EMAIL = "boss@example.com"; // listed in the harness's ADMIN_EMAILS

const register = (ctx: Ctx, email: string) =>
  request(ctx.app).post("/api/auth/register").send({ email, password: PASSWORD, displayName: "Tester" });
const login = (ctx: Ctx, email: string, password = PASSWORD) =>
  request(ctx.app).post("/api/auth/login").send({ email, password });

describe("Authentication: registration (สมัคร)", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("creates the account, starts a session in an httpOnly cookie and keeps the token out of the body", async () => {
    const res = await register(ctx, "new.student@example.com");
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "new.student@example.com", role: "user" });
    expect(res.body).not.toHaveProperty("token");
    expect(sessionTokenFromResponse(res)).toBeTruthy();

    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^sp_session=/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure"); // harness runs as non-production
    expect(cookie).toContain(`Max-Age=${SESSION_TTL_MS / 1000}`);
  });

  it("stores only a scrypt hash of the password and a hash of the session token", async () => {
    const res = await register(ctx, "hash.check@example.com");
    const token = sessionTokenFromResponse(res) as string;

    const users = await ctx.db.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1",
      ["hash.check@example.com"],
    );
    expect(users.rows[0].password_hash.startsWith("scrypt$")).toBe(true);
    expect(users.rows[0].password_hash).not.toContain(PASSWORD);

    const sessions = await ctx.db.query<{ token_hash: string }>("SELECT token_hash FROM sessions");
    expect(sessions.rows.map((r) => r.token_hash)).not.toContain(token);
    expect(sessions.rows.some((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });

  it("normalises the email to lowercase so the same account cannot be registered twice", async () => {
    expect((await register(ctx, "Mixed.Case@Example.com")).body.user.email).toBe("mixed.case@example.com");
    expect((await register(ctx, "mixed.case@example.com")).status).toBe(409);
  });

  it("rejects an invalid email, a short password and a missing display name", async () => {
    expect((await request(ctx.app).post("/api/auth/register").send({ email: "not-an-email", password: PASSWORD, displayName: "X" })).status).toBe(400);
    expect((await request(ctx.app).post("/api/auth/register").send({ email: "short@example.com", password: "1234567", displayName: "X" })).status).toBe(400);
    expect((await request(ctx.app).post("/api/auth/register").send({ email: "noname@example.com", password: PASSWORD })).status).toBe(400);
  });
});

describe("Authentication: login (เข้าสู่ระบบ)", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await createTestApp();
    await register(ctx, "login.user@example.com");
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("issues a new session cookie for correct credentials and the cookie authenticates /me", async () => {
    const res = await login(ctx, "login.user@example.com");
    expect(res.status).toBe(200);
    const token = sessionTokenFromResponse(res) as string;
    expect(token).toBeTruthy();

    const me = await request(ctx.app).get("/api/auth/me").set(sessionCookieHeader(token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("login.user@example.com");
  });

  it("accepts the email in any letter case", async () => {
    expect((await login(ctx, "LOGIN.USER@example.com")).status).toBe(200);
  });

  it("returns the same 401 for a wrong password and for an unknown email (no account enumeration)", async () => {
    const wrongPassword = await login(ctx, "login.user@example.com", "wrong-password-value");
    const unknownEmail = await login(ctx, "nobody@example.com", "wrong-password-value");
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
  });

  it("does not accept the Authorization header as a session (cookies only)", async () => {
    const res = await register(ctx, "bearer.check@example.com");
    const token = sessionTokenFromResponse(res) as string;
    const viaBearer = await request(ctx.app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(viaBearer.status).toBe(401);
  });
});

describe("Authentication: logout (ออกจากระบบ)", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("clears the cookie and revokes the server-side session, so a copied token stops working", async () => {
    const res = await register(ctx, "leaver@example.com");
    const token = sessionTokenFromResponse(res) as string;

    const out = await request(ctx.app).post("/api/auth/logout").set(sessionCookieHeader(token));
    expect(out.status).toBe(204);
    expect(String(out.headers["set-cookie"])).toMatch(/^sp_session=; Max-Age=0;/);

    // Replaying the old token must fail even though the browser had it: the row is gone.
    expect((await request(ctx.app).get("/api/auth/me").set(sessionCookieHeader(token))).status).toBe(401);
  });

  it("is idempotent: logging out without a session still succeeds and clears the cookie", async () => {
    const res = await request(ctx.app).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");
  });

  it("leaves other sessions for the same user intact", async () => {
    const first = await register(ctx, "two.devices@example.com");
    const second = await login(ctx, "two.devices@example.com");
    await request(ctx.app).post("/api/auth/logout").set(sessionCookieHeader(sessionTokenFromResponse(first) as string));
    const stillIn = await request(ctx.app)
      .get("/api/auth/me")
      .set(sessionCookieHeader(sessionTokenFromResponse(second) as string));
    expect(stillIn.status).toBe(200);
  });
});

describe("Authentication: session expiry (token หมดอายุ)", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("keeps the session valid just before the 7-day TTL and rejects it after", async () => {
    const res = await register(ctx, "expires.soon@example.com");
    const token = sessionTokenFromResponse(res) as string;
    const start = new Date("2026-11-22T10:00:00Z").getTime();

    ctx.setNow(new Date(start + SESSION_TTL_MS - 60_000)); // one minute before expiry
    expect((await request(ctx.app).get("/api/auth/me").set(sessionCookieHeader(token))).status).toBe(200);

    ctx.setNow(new Date(start + SESSION_TTL_MS + 1_000)); // one second after expiry
    expect((await request(ctx.app).get("/api/auth/me").set(sessionCookieHeader(token))).status).toBe(401);
  });

  it("issues a fresh session on the next login after the old one has expired", async () => {
    await register(ctx, "comeback@example.com");
    ctx.setNow(new Date("2026-12-20T10:00:00Z"));
    const again = await login(ctx, "comeback@example.com");
    expect(again.status).toBe(200);
    const token = sessionTokenFromResponse(again) as string;
    expect((await request(ctx.app).get("/api/auth/me").set(sessionCookieHeader(token))).status).toBe(200);
  });

  it("treats a request with no cookie as unauthenticated", async () => {
    expect((await request(ctx.app).get("/api/auth/me")).status).toBe(401);
    expect((await request(ctx.app).get("/api/auth/me").set("Cookie", "sp_session=")).status).toBe(401);
  });
});

describe("Authentication: admin authorisation (สิทธิ์ admin)", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("makes an email from ADMIN_EMAILS an admin at registration", async () => {
    const res = await register(ctx, ADMIN_EMAIL);
    expect(res.body.user.role).toBe("admin");
  });

  it("keeps ordinary accounts as users, and the role is assigned by email, not by the client", async () => {
    const res = await request(ctx.app)
      .post("/api/auth/register")
      .send({ email: "sneaky@example.com", password: PASSWORD, displayName: "X", role: "admin" });
    expect(res.body.user.role).toBe("user");
  });

  it("returns 401 to anonymous callers and 403 to signed-in students on every admin route", async () => {
    const student = sessionTokenFromResponse(await register(ctx, "student.admin@example.com")) as string;
    const adminRoutes = [
      ["get", "/api/admin/stats"],
      ["get", "/api/admin/reports/tasks.csv"],
      ["get", "/api/admin/users"],
      ["post", "/api/admin/users/anything/badges"],
    ] as const;

    for (const [method, path] of adminRoutes) {
      expect((await request(ctx.app)[method](path)).status, `anonymous ${path}`).toBe(401);
      expect((await request(ctx.app)[method](path).set(sessionCookieHeader(student))).status, `student ${path}`).toBe(403);
    }
  });

  it("lets an admin session reach the admin routes", async () => {
    const admin = sessionTokenFromResponse(await register(ctx, ADMIN_EMAIL)) as string;
    expect((await request(ctx.app).get("/api/admin/stats").set(sessionCookieHeader(admin))).status).toBe(200);
  });
});

describe("cookie and password helpers", () => {
  it("reads a named cookie from a multi-cookie header and ignores malformed values", () => {
    expect(readCookie("theme=dark; sp_session=abc_DEF-123; lang=th", "sp_session")).toBe("abc_DEF-123");
    expect(readCookie("sp_session=a%20b", "sp_session")).toBe("a b");
    expect(readCookie("theme=dark", "sp_session")).toBeNull();
    expect(readCookie(undefined, "sp_session")).toBeNull();
    expect(readCookie("sp_session=%E0%A4%A", "sp_session")).toBeNull();
  });

  it("builds Set-Cookie values with HttpOnly and SameSite, and Secure only when asked", () => {
    const dev = sessionCookie("tok", { secure: false });
    expect(dev).toBe(`sp_session=tok; Max-Age=${SESSION_TTL_MS / 1000}; Path=/; HttpOnly; SameSite=Lax`);
    expect(sessionCookie("tok", { secure: true })).toContain("; Secure");
    expect(clearSessionCookie({ secure: false })).toBe("sp_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
  });

  it("verifies a scrypt hash and rejects wrong passwords and malformed stored values", async () => {
    const stored = await hashPassword("a-good-password");
    expect(await verifyPassword("a-good-password", stored)).toBe(true);
    expect(await verifyPassword("a-bad-password", stored)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
