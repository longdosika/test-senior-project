import { randomUUID } from "node:crypto";
import express, { Router, type Request } from "express";
import { BADGE_IDS, BADGES, isBadgeId, type BadgeId } from "../../lib/badges";
import { validateQuiz, scoreQuiz } from "../../lib/quiz";
import type { AppDeps } from "../deps";
import { HttpError, optionalInt, optionalString, requiredString, requireBody } from "../http";
import { authedUser, requireAdmin, requireUser } from "../middleware";
import * as repo from "../repo";
import { refreshBadges } from "../services/badges";
import { ProviderError, ProviderNotConfiguredError } from "../providers/errors";

export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "application/pdf", "text/plain"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_AI_INPUT = 8000;

function baseContentType(header: string | undefined): string {
  return (header ?? "").split(";")[0].trim().toLowerCase();
}

function safeFilename(raw: string | undefined): string {
  let name = raw ?? "";
  try {
    name = decodeURIComponent(name);
  } catch {
    // keep the raw value if it is not valid percent-encoding
  }
  const cleaned = name.split(/[\\/]/).pop()?.replace(/[^\w.\- ]/g, "_").slice(0, 120).trim();
  return cleaned || "file";
}

function parseBadgeList(ids: BadgeId[]) {
  return ids.map((id) => ({ id, ...BADGES[id] }));
}

export function featureRouter(deps: AppDeps) {
  const router = Router();

  // ---------- File upload & storage ----------
  router.post(
    "/files",
    requireUser(deps),
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    async (req, res) => {
      const user = authedUser(req);
      const contentType = baseContentType(req.get("content-type"));
      if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(contentType)) {
        throw new HttpError(415, `content type must be one of ${ALLOWED_UPLOAD_TYPES.join(", ")}`);
      }
      const body = req.body as unknown;
      if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, "file body is empty");
      const id = randomUUID();
      await deps.storage.put(id, body);
      const file = await repo.insertFile(deps.db, {
        id,
        ownerId: user.id,
        filename: safeFilename(req.get("x-filename")),
        contentType,
        sizeBytes: body.length,
        storageKey: id,
      });
      const newBadges = await refreshBadges(deps.db, user.id);
      res.status(201).json({ file, newBadges: parseBadgeList(newBadges) });
    },
  );

  router.get("/files/:id", requireUser(deps), async (req, res) => {
    const user = authedUser(req);
    const file = await repo.getFile(deps.db, String(req.params.id));
    if (!file || (file.ownerId !== user.id && user.role !== "admin")) throw new HttpError(404, "file not found");
    const data = await deps.storage.get(file.storageKey);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Length", String(data.length));
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename.replace(/"/g, "")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(data);
  });

  // ---------- Payments (Omise) ----------
  router.post("/payments", requireUser(deps), async (req, res) => {
    const user = authedUser(req);
    const body = requireBody(req.body);
    const amountSatang = optionalInt(body.amountSatang, "amountSatang", 2000, 10_000_000);
    if (amountSatang === undefined) throw new HttpError(400, "amountSatang is required");
    const token = requiredString(body.token, "token", 200);
    const description = optionalString(body.description, "description", 200) ?? "Senior Project payment";
    const charge = await deps.payments.charge({
      amountSatang,
      currency: "THB",
      token,
      description,
      metadata: { userId: user.id },
    });
    const payment = await repo.insertPayment(deps.db, {
      id: randomUUID(),
      userId: user.id,
      provider: "omise",
      providerChargeId: charge.id,
      amountSatang,
      currency: "THB",
      status: charge.status,
    });
    res.status(201).json({ payment });
  });

  // ---------- AI summarisation ----------
  router.post("/ai/summarize", requireUser(deps), async (req, res) => {
    const body = requireBody(req.body);
    const text = requiredString(body.text, "text", MAX_AI_INPUT);
    const summary = await deps.ai.summarize(text);
    res.json({ summary });
  });

  // ---------- Quiz engine ----------
  router.get("/quizzes", requireUser(deps), async (_req, res) => {
    res.json({ items: await repo.listQuizzes(deps.db) });
  });

  router.post("/quizzes", requireUser(deps), requireAdmin, async (req, res) => {
    const user = authedUser(req);
    const parsed = validateQuiz(req.body);
    if (!parsed.ok) throw new HttpError(400, parsed.error);
    const id = randomUUID();
    await repo.insertQuiz(deps.db, {
      id,
      title: parsed.value.title,
      createdBy: user.id,
      questions: parsed.value.questions.map((q) => ({ id: randomUUID(), ...q })),
    });
    res.status(201).json({ id });
  });

  // Answers are never sent to the client before submission.
  router.get("/quizzes/:id", requireUser(deps), async (req, res) => {
    const quiz = await repo.getQuizWithAnswers(deps.db, String(req.params.id));
    if (!quiz) throw new HttpError(404, "quiz not found");
    res.json({
      id: quiz.id,
      title: quiz.title,
      questions: quiz.questions.map((q) => ({ id: q.id, prompt: q.prompt, choices: q.choices })),
    });
  });

  router.post("/quizzes/:id/attempts", requireUser(deps), async (req: Request, res) => {
    const user = authedUser(req);
    const quiz = await repo.getQuizWithAnswers(deps.db, String(req.params.id));
    if (!quiz) throw new HttpError(404, "quiz not found");
    const body = requireBody(req.body);
    const answers = body.answers;
    if (!Array.isArray(answers) || answers.length > quiz.questions.length) {
      throw new HttpError(400, "answers must be an array no longer than the question count");
    }
    const normalised = quiz.questions.map((_, i) => {
      const a = answers[i];
      if (a === undefined || a === null) return null;
      if (!Number.isInteger(a)) throw new HttpError(400, `answer ${i + 1} must be an integer or null`);
      return a as number;
    });
    const { score, total, percent } = scoreQuiz(quiz.questions, normalised);
    await repo.insertQuizAttempt(deps.db, { id: randomUUID(), quizId: quiz.id, userId: user.id, score, total });
    const newBadges = await refreshBadges(deps.db, user.id);
    res.status(201).json({ score, total, percent, newBadges: parseBadgeList(newBadges) });
  });

  // ---------- Gamification & badges ----------
  router.get("/me/badges", requireUser(deps), async (req, res) => {
    const user = authedUser(req);
    const earned = (await repo.earnedBadgeIds(deps.db, user.id)).filter(isBadgeId);
    res.json({ earned: parseBadgeList(earned), available: BADGE_IDS.map((id) => ({ id, ...BADGES[id] })) });
  });

  // ---------- Push subscriptions & notifications ----------
  router.post("/push/subscriptions", requireUser(deps), async (req, res) => {
    const user = authedUser(req);
    const body = requireBody(req.body);
    const endpoint = requiredString(body.endpoint, "endpoint", 2048);
    if (!/^https:\/\//.test(endpoint)) throw new HttpError(400, "endpoint must be an https URL");
    const keys = (body.keys ?? {}) as Record<string, unknown>;
    const p256dh = requiredString(keys.p256dh, "keys.p256dh", 512);
    const auth = requiredString(keys.auth, "keys.auth", 512);
    await repo.upsertPushSubscription(deps.db, { id: randomUUID(), userId: user.id, endpoint, p256dh, auth });
    res.status(201).json({ ok: true });
  });

  /**
   * Admin broadcast. channels: "push" sends to stored Web Push subscriptions
   * (all users, or only `userId`); "line" sends a LINE push message to `lineTo`.
   */
  router.post("/notifications", requireUser(deps), requireAdmin, async (req, res) => {
    const body = requireBody(req.body);
    const title = requiredString(body.title, "title", 100);
    const text = requiredString(body.body, "body", 1000);
    const channels = Array.isArray(body.channels) ? body.channels : [];
    if (channels.length === 0 || channels.some((c) => c !== "push" && c !== "line")) {
      throw new HttpError(400, 'channels must be a non-empty array of "push" | "line"');
    }
    const userId = optionalString(body.userId, "userId", 100);
    const result: Record<string, { sent: number; failed: number }> = {};

    if (channels.includes("push")) {
      const subs = await repo.listPushSubscriptions(deps.db, userId);
      const counts = { sent: 0, failed: 0 };
      for (const sub of subs) {
        try {
          await deps.push.send(sub, { title, body: text });
          counts.sent += 1;
        } catch {
          counts.failed += 1;
        }
      }
      result.push = counts;
    }

    if (channels.includes("line")) {
      const lineTo = requiredString(body.lineTo, "lineTo", 100);
      const counts = { sent: 0, failed: 0 };
      try {
        await deps.line.push(lineTo, `${title}\n${text}`);
        counts.sent = 1;
      } catch {
        counts.failed = 1;
      }
      result.line = counts;
    }

    res.json({ result });
  });

  return router;
}

/** Maps provider errors to HTTP status codes; used by the app's error handler. */
export function providerErrorStatus(err: unknown): number | null {
  if (err instanceof ProviderNotConfiguredError) return 503;
  if (err instanceof ProviderError) return 502;
  return null;
}
