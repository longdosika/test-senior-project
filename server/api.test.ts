import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, sessionCookieHeader, sessionTokenFromResponse } from "./testing/harness";

type Ctx = Awaited<ReturnType<typeof createTestApp>>;

const PASSWORD = "correct-horse-battery";

async function register(ctx: Ctx, email: string, displayName = "Student") {
  const res = await request(ctx.app)
    .post("/api/auth/register")
    .send({ email, password: PASSWORD, displayName });
  expect(res.status).toBe(201);
  const token = sessionTokenFromResponse(res);
  if (!token) throw new Error("register did not set the session cookie");
  return { user: res.body.user as { id: string; role: string }, token };
}

const auth = (token: string) => sessionCookieHeader(token);

describe("Express API", () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  describe("auth & accounts", () => {
    it("registers, logs in and returns the current user", async () => {
      const { token, user } = await register(ctx, "student@example.com", "Somchai");
      expect(user.role).toBe("user");

      const login = await request(ctx.app)
        .post("/api/auth/login")
        .send({ email: "student@example.com", password: PASSWORD });
      expect(login.status).toBe(200);

      const me = await request(ctx.app).get("/api/auth/me").set(auth(token));
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe("student@example.com");
      expect(me.body.user).not.toHaveProperty("passwordHash");
    });

    it("rejects duplicate email, weak password and wrong credentials", async () => {
      await register(ctx, "dup@example.com");
      const dup = await request(ctx.app)
        .post("/api/auth/register")
        .send({ email: "dup@example.com", password: PASSWORD, displayName: "X" });
      expect(dup.status).toBe(409);

      const weak = await request(ctx.app)
        .post("/api/auth/register")
        .send({ email: "weak@example.com", password: "short", displayName: "X" });
      expect(weak.status).toBe(400);

      const wrong = await request(ctx.app)
        .post("/api/auth/login")
        .send({ email: "dup@example.com", password: "wrong-password" });
      expect(wrong.status).toBe(401);
    });

    it("requires a token for protected routes and invalidates it on logout", async () => {
      expect((await request(ctx.app).get("/api/auth/me")).status).toBe(401);
      const { token } = await register(ctx, "logout@example.com");
      expect((await request(ctx.app).post("/api/auth/logout").set(auth(token))).status).toBe(204);
      expect((await request(ctx.app).get("/api/auth/me").set(auth(token))).status).toBe(401);
    });

    it("expires sessions after the TTL", async () => {
      const { token } = await register(ctx, "expiry@example.com");
      ctx.setNow(new Date("2026-12-10T10:00:00Z")); // 18 days later, past the 7-day TTL
      expect((await request(ctx.app).get("/api/auth/me").set(auth(token))).status).toBe(401);
    });

    it("makes emails listed in ADMIN_EMAILS admins", async () => {
      const { user } = await register(ctx, "boss@example.com");
      expect(user.role).toBe("admin");
    });
  });

  describe("tasks, search and filters", () => {
    it("creates, filters, updates and deletes tasks and emits realtime events", async () => {
      const { token } = await register(ctx, "tasks@example.com");

      const created = await request(ctx.app)
        .post("/api/tasks")
        .set(auth(token))
        .send({ title: "Write proposal", description: "Thai and English" });
      expect(created.status).toBe(201);
      expect(created.body.newBadges).toEqual(["first-task"]);
      await request(ctx.app).post("/api/tasks").set(auth(token)).send({ title: "Design DB", status: "doing" });

      const search = await request(ctx.app).get("/api/tasks?q=proposal").set(auth(token));
      expect(search.body.total).toBe(1);
      expect(search.body.items[0].title).toBe("Write proposal");

      const byStatus = await request(ctx.app).get("/api/tasks?status=doing").set(auth(token));
      expect(byStatus.body.items.map((t: { title: string }) => t.title)).toEqual(["Design DB"]);

      const id = created.body.task.id as string;
      const updated = await request(ctx.app).patch(`/api/tasks/${id}`).set(auth(token)).send({ status: "done" });
      expect(updated.status).toBe(200);
      expect(updated.body.task.status).toBe("done");

      expect((await request(ctx.app).delete(`/api/tasks/${id}`).set(auth(token))).status).toBe(204);
      expect((await request(ctx.app).get(`/api/tasks/${id}`).set(auth(token))).status).toBe(404);

      const types = ctx.events.map((e) => e.type);
      expect(types).toEqual(["task.created", "task.created", "task.updated", "task.deleted"]);
    });

    it("paginates results and validates query parameters", async () => {
      const { token } = await register(ctx, "pages@example.com");
      for (let i = 0; i < 3; i++) {
        await request(ctx.app).post("/api/tasks").set(auth(token)).send({ title: `task ${i}` });
      }
      const page = await request(ctx.app).get("/api/tasks?page=2&pageSize=2").set(auth(token));
      expect(page.body.total).toBe(3);
      expect(page.body.items).toHaveLength(1);

      const bad = await request(ctx.app).get("/api/tasks?status=nope").set(auth(token));
      expect(bad.status).toBe(400);
    });

    it("hides other users' tasks, but lets admins see everything with scope=all", async () => {
      const owner = await register(ctx, "owner@example.com");
      const other = await register(ctx, "other@example.com");
      const admin = await register(ctx, "boss@example.com");
      const created = await request(ctx.app).post("/api/tasks").set(auth(owner.token)).send({ title: "Private" });
      const id = created.body.task.id as string;

      expect((await request(ctx.app).get(`/api/tasks/${id}`).set(auth(other.token))).status).toBe(404);
      expect((await request(ctx.app).get("/api/tasks").set(auth(other.token))).body.total).toBe(0);

      const all = await request(ctx.app).get("/api/tasks?scope=all").set(auth(admin.token));
      expect(all.body.total).toBe(1);
    });
  });

  describe("admin dashboard & reports", () => {
    it("forbids non-admins and serves stats and CSV to admins", async () => {
      const user = await register(ctx, "normal@example.com");
      const admin = await register(ctx, "boss@example.com");
      await request(ctx.app).post("/api/tasks").set(auth(user.token)).send({ title: "=HYPERLINK(\"x\")", status: "done" });

      expect((await request(ctx.app).get("/api/admin/stats").set(auth(user.token))).status).toBe(403);
      expect((await request(ctx.app).get("/api/admin/stats")).status).toBe(401);

      const stats = await request(ctx.app).get("/api/admin/stats").set(auth(admin.token));
      expect(stats.status).toBe(200);
      expect(stats.body.users).toBe(2);
      expect(stats.body.tasks.byStatus.done).toBe(1);

      const csv = await request(ctx.app).get("/api/admin/reports/tasks.csv").set(auth(admin.token));
      expect(csv.headers["content-type"]).toContain("text/csv");
      expect(csv.text).toContain("id,title,status,owner_email");
      expect(csv.text).toContain("'=HYPERLINK");
      expect(csv.text).toContain("normal@example.com");
    });
  });

  describe("file upload & storage", () => {
    it("stores allowed files, serves them to the owner and rejects other types", async () => {
      const owner = await register(ctx, "files@example.com");
      const other = await register(ctx, "snoop@example.com");
      const bytes = Buffer.from("hello senior project");

      const bad = await request(ctx.app)
        .post("/api/files")
        .set(auth(owner.token))
        .set("Content-Type", "application/x-msdownload")
        .send(bytes);
      expect(bad.status).toBe(415);

      const up = await request(ctx.app)
        .post("/api/files")
        .set(auth(owner.token))
        .set("Content-Type", "text/plain; charset=utf-8")
        .set("X-Filename", encodeURIComponent("../proposal final.txt"))
        .send(bytes);
      expect(up.status).toBe(201);
      expect(up.body.file.filename).toBe("proposal final.txt");
      expect(up.body.newBadges.map((b: { id: string }) => b.id)).toContain("uploader");

      const download = await request(ctx.app).get(`/api/files/${up.body.file.id}`).set(auth(owner.token));
      expect(download.status).toBe(200);
      expect(download.text).toBe("hello senior project");
      expect(download.headers["content-disposition"]).toContain("attachment");

      const denied = await request(ctx.app).get(`/api/files/${up.body.file.id}`).set(auth(other.token));
      expect(denied.status).toBe(404);
    });
  });

  describe("payments (Omise adapter via fake)", () => {
    it("charges the card token through the provider and records the payment", async () => {
      const { token } = await register(ctx, "payer@example.com");
      const res = await request(ctx.app)
        .post("/api/payments")
        .set(auth(token))
        .send({ amountSatang: 15000, token: "tokn_test_123", description: "Poster printing" });
      expect(res.status).toBe(201);
      expect(res.body.payment.status).toBe("successful");
      expect(ctx.fakes.charges[0]).toMatchObject({ amountSatang: 15000, currency: "THB", token: "tokn_test_123" });

      const bad = await request(ctx.app).post("/api/payments").set(auth(token)).send({ amountSatang: 10, token: "t" });
      expect(bad.status).toBe(400);
    });
  });

  describe("AI summarisation (adapter via fake)", () => {
    it("requires auth and returns a summary", async () => {
      expect((await request(ctx.app).post("/api/ai/summarize").send({ text: "x" })).status).toBe(401);
      const { token } = await register(ctx, "ai@example.com");
      const res = await request(ctx.app)
        .post("/api/ai/summarize")
        .set(auth(token))
        .send({ text: "Senior project spec describing features" });
      expect(res.status).toBe(200);
      expect(res.body.summary).toContain("สรุป");
      expect(ctx.fakes.summaries).toHaveLength(1);
    });
  });

  describe("quiz engine & badges", () => {
    it("admins create quizzes; students get questions without answers and receive scores", async () => {
      const admin = await register(ctx, "boss@example.com");
      const student = await register(ctx, "quizzer@example.com");

      const denied = await request(ctx.app)
        .post("/api/quizzes")
        .set(auth(student.token))
        .send({ title: "x", questions: [] });
      expect(denied.status).toBe(403);

      const created = await request(ctx.app)
        .post("/api/quizzes")
        .set(auth(admin.token))
        .send({
          title: "Agile basics",
          questions: [
            { prompt: "Sprint length?", choices: ["1 week", "2 weeks"], answerIndex: 1 },
            { prompt: "Who owns the backlog?", choices: ["Dev", "Product Owner"], answerIndex: 1 },
          ],
        });
      expect(created.status).toBe(201);

      const quiz = await request(ctx.app).get(`/api/quizzes/${created.body.id}`).set(auth(student.token));
      expect(quiz.body.questions[0]).not.toHaveProperty("answerIndex");

      const attempt = await request(ctx.app)
        .post(`/api/quizzes/${created.body.id}/attempts`)
        .set(auth(student.token))
        .send({ answers: [1, 1] });
      expect(attempt.status).toBe(201);
      expect(attempt.body).toMatchObject({ score: 2, total: 2, percent: 100 });
      expect(attempt.body.newBadges.map((b: { id: string }) => b.id)).toEqual(
        expect.arrayContaining(["quiz-taker", "perfect-score"]),
      );

      const badges = await request(ctx.app).get("/api/me/badges").set(auth(student.token));
      expect(badges.body.earned.map((b: { id: string }) => b.id)).toEqual(
        expect.arrayContaining(["quiz-taker", "perfect-score"]),
      );
    });

    it("awards the finisher badge after five completed tasks", async () => {
      const { token } = await register(ctx, "finisher@example.com");
      for (let i = 0; i < 5; i++) {
        const t = await request(ctx.app).post("/api/tasks").set(auth(token)).send({ title: `t${i}` });
        await request(ctx.app).patch(`/api/tasks/${t.body.task.id}`).set(auth(token)).send({ status: "done" });
      }
      const badges = await request(ctx.app).get("/api/me/badges").set(auth(token));
      expect(badges.body.earned.map((b: { id: string }) => b.id)).toContain("finisher");
    });
  });

  describe("push & LINE notifications (adapters via fakes)", () => {
    it("stores push subscriptions and sends admin broadcasts to push and LINE", async () => {
      const admin = await register(ctx, "boss@example.com");
      const student = await register(ctx, "push@example.com");

      const sub = await request(ctx.app)
        .post("/api/push/subscriptions")
        .set(auth(student.token))
        .send({ endpoint: "https://push.example.test/abc", keys: { p256dh: "p", auth: "a" } });
      expect(sub.status).toBe(201);

      const res = await request(ctx.app)
        .post("/api/notifications")
        .set(auth(admin.token))
        .send({ title: "Deadline", body: "Submit by Friday", channels: ["push", "line"], lineTo: "Uline-test" });
      expect(res.status).toBe(200);
      expect(res.body.result).toEqual({ push: { sent: 1, failed: 0 }, line: { sent: 1, failed: 0 } });
      expect(ctx.fakes.pushes[0].payload).toEqual({ title: "Deadline", body: "Submit by Friday" });
      expect(ctx.fakes.lines[0].to).toBe("Uline-test");

      const forbidden = await request(ctx.app)
        .post("/api/notifications")
        .set(auth(student.token))
        .send({ title: "x", body: "y", channels: ["push"] });
      expect(forbidden.status).toBe(403);
    });
  });
});
