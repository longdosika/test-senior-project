import { randomUUID } from "node:crypto";
import { Router } from "express";
import { hashPassword, hashSessionToken, newSessionToken, verifyPassword } from "../auth";
import type { AppDeps } from "../deps";
import { HttpError, requiredString, requireBody } from "../http";
import { authedUser, requireUser } from "../middleware";
import * as repo from "../repo";
import type { Role } from "../repo";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 200) {
    throw new HttpError(400, "password must be 8-200 characters");
  }
  return value;
}

function validEmail(value: unknown): string {
  const email = requiredString(value, "email", 200).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "email is invalid");
  return email;
}

export function authRouter(deps: AppDeps) {
  const router = Router();
  const now = deps.now ?? (() => new Date());

  async function issueSession(userId: string): Promise<string> {
    const token = newSessionToken();
    await repo.insertSession(deps.db, hashSessionToken(token), userId, new Date(now().getTime() + SESSION_TTL_MS));
    return token;
  }

  router.post("/register", async (req, res) => {
    const body = requireBody(req.body);
    const email = validEmail(body.email);
    const password = validPassword(body.password);
    const displayName = requiredString(body.displayName, "displayName", 80);
    if (await repo.findUserWithHashByEmail(deps.db, email)) {
      throw new HttpError(409, "email already registered");
    }
    const role: Role = deps.adminEmails.includes(email) ? "admin" : "user";
    const user = await repo.insertUser(deps.db, {
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      displayName,
      role,
    });
    const token = await issueSession(user.id);
    res.status(201).json({ user, token });
  });

  router.post("/login", async (req, res) => {
    const body = requireBody(req.body);
    const email = validEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const found = await repo.findUserWithHashByEmail(deps.db, email);
    // Always run one verification so response timing does not reveal whether the email exists.
    const ok = await verifyPassword(password, found?.passwordHash ?? "scrypt$AAAA$AAAA");
    if (!found || !ok) throw new HttpError(401, "invalid email or password");
    const token = await issueSession(found.user.id);
    res.json({ user: found.user, token });
  });

  router.post("/logout", requireUser(deps), async (req, res) => {
    const { sessionHash } = req as unknown as { sessionHash: string };
    await repo.deleteSession(deps.db, sessionHash);
    res.status(204).end();
  });

  router.get("/me", requireUser(deps), (req, res) => {
    res.json({ user: authedUser(req) });
  });

  return router;
}
