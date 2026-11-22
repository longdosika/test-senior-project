import type { NextFunction, Request, Response } from "express";
import type { AppDeps } from "./deps";
import { SESSION_COOKIE, hashSessionToken, readCookie } from "./auth";
import { HttpError } from "./http";
import * as repo from "./repo";
import type { User } from "./repo";

export type AuthedRequest = Request & { user: User; sessionHash: string };

/** The session token travels only in the httpOnly session cookie, never in a header or body. */
export function sessionTokenFrom(req: Request): string | null {
  return readCookie(req.headers.cookie, SESSION_COOKIE);
}

/** Requires a valid session cookie; attaches `user` and `sessionHash` to the request. */
export function requireUser(deps: AppDeps) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = sessionTokenFrom(req);
      if (!token) throw new HttpError(401, "authentication required");
      const sessionHash = hashSessionToken(token);
      const user = await repo.findUserBySession(deps.db, sessionHash, (deps.now ?? (() => new Date()))());
      if (!user) throw new HttpError(401, "invalid or expired session");
      const authed = req as AuthedRequest;
      authed.user = user;
      authed.sessionHash = sessionHash;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Requires an authenticated user with role admin. Must run after requireUser. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const user = (req as Partial<AuthedRequest>).user;
  if (!user) {
    next(new HttpError(401, "authentication required"));
    return;
  }
  if (user.role !== "admin") {
    next(new HttpError(403, "admin role required"));
    return;
  }
  next();
}

export function authedUser(req: Request): User {
  const user = (req as Partial<AuthedRequest>).user;
  if (!user) throw new HttpError(401, "authentication required");
  return user;
}
