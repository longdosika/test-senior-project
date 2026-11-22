import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, sessionCookieHeader, sessionTokenFromResponse } from "./testing/harness";

/** Gamification admin UI backend: list users with badges, and grant a badge by hand. */
type Ctx = Awaited<ReturnType<typeof createTestApp>>;
const PASSWORD = "correct-horse-battery";

async function signUp(ctx: Ctx, email: string) {
  const res = await request(ctx.app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, displayName: email.split("@")[0] });
  return { user: res.body.user as { id: string }, cookie: sessionCookieHeader(sessionTokenFromResponse(res) as string) };
}

describe("admin gamification: badges", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await createTestApp();
  });
  afterEach(async () => {
    await ctx.close();
  });

  it("lists every user with the badges they hold, without leaking password hashes", async () => {
    const admin = await signUp(ctx, "boss@example.com");
    const student = await signUp(ctx, "earner@example.com");
    await request(ctx.app).post("/api/tasks").set(student.cookie).send({ title: "first" }); // earns first-task

    const res = await request(ctx.app).get("/api/admin/users").set(admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const row = res.body.items.find((i: { user: { email: string } }) => i.user.email === "earner@example.com");
    expect(row.badges.map((b: { id: string }) => b.id)).toEqual(["first-task"]);
    expect(row.badges[0]).toMatchObject({ title: "First Step" });
    expect(JSON.stringify(res.body)).not.toContain("scrypt$");
  });

  it("grants a badge to a user, reports newly awarded, and shows it on that user's profile", async () => {
    const admin = await signUp(ctx, "boss@example.com");
    const student = await signUp(ctx, "rewarded@example.com");

    const granted = await request(ctx.app)
      .post(`/api/admin/users/${student.user.id}/badges`)
      .set(admin.cookie)
      .send({ badgeId: "uploader" });
    expect(granted.status).toBe(201);
    expect(granted.body).toMatchObject({ awarded: true, badge: { id: "uploader", title: "Uploader" } });

    const mine = await request(ctx.app).get("/api/me/badges").set(student.cookie);
    expect(mine.body.earned.map((b: { id: string }) => b.id)).toContain("uploader");
  });

  it("does not duplicate a badge that the user already holds", async () => {
    const admin = await signUp(ctx, "boss@example.com");
    const student = await signUp(ctx, "twice@example.com");
    await request(ctx.app).post(`/api/admin/users/${student.user.id}/badges`).set(admin.cookie).send({ badgeId: "quiz-taker" });

    const again = await request(ctx.app)
      .post(`/api/admin/users/${student.user.id}/badges`)
      .set(admin.cookie)
      .send({ badgeId: "quiz-taker" });
    expect(again.status).toBe(200);
    expect(again.body.awarded).toBe(false);

    const rows = await ctx.db.query("SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2", [
      student.user.id,
      "quiz-taker",
    ]);
    expect(rows.rows).toHaveLength(1);
  });

  it("rejects unknown badges, missing badge ids and unknown users", async () => {
    const admin = await signUp(ctx, "boss@example.com");
    const student = await signUp(ctx, "validate@example.com");

    const unknown = await request(ctx.app)
      .post(`/api/admin/users/${student.user.id}/badges`)
      .set(admin.cookie)
      .send({ badgeId: "dragon-slayer" });
    expect(unknown.status).toBe(400);

    const missing = await request(ctx.app).post(`/api/admin/users/${student.user.id}/badges`).set(admin.cookie).send({});
    expect(missing.status).toBe(400);

    const noUser = await request(ctx.app).post("/api/admin/users/no-such-user/badges").set(admin.cookie).send({ badgeId: "uploader" });
    expect(noUser.status).toBe(404);
  });

  it("forbids students from viewing or granting badges", async () => {
    const admin = await signUp(ctx, "boss@example.com");
    const student = await signUp(ctx, "nosy@example.com");

    expect((await request(ctx.app).get("/api/admin/users").set(student.cookie)).status).toBe(403);
    const attempt = await request(ctx.app)
      .post(`/api/admin/users/${student.user.id}/badges`)
      .set(student.cookie)
      .send({ badgeId: "perfect-score" });
    expect(attempt.status).toBe(403);

    const mine = await request(ctx.app).get("/api/me/badges").set(student.cookie);
    expect(mine.body.earned).toHaveLength(0);
    expect(admin.user.id).toBeTruthy();
  });
});
