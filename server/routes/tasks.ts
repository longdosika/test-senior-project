import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import type { AppDeps } from "../deps";
import { HttpError, optionalString, parseQueryInt, requiredString, requireBody } from "../http";
import { authedUser, requireUser } from "../middleware";
import * as repo from "../repo";
import { TASK_STATUSES, type Task, type TaskStatus, type User } from "../repo";
import { refreshBadges } from "../services/badges";

function parseStatus(value: unknown): TaskStatus {
  if (typeof value !== "string" || !(TASK_STATUSES as readonly string[]).includes(value)) {
    throw new HttpError(400, `status must be one of ${TASK_STATUSES.join(", ")}`);
  }
  return value as TaskStatus;
}

function canAccess(user: User, task: Task): boolean {
  return user.role === "admin" || task.createdBy === user.id;
}

async function loadAccessibleTask(deps: AppDeps, req: Request): Promise<{ user: User; task: Task }> {
  const user = authedUser(req);
  const task = await repo.getTask(deps.db, String(req.params.id));
  if (!task || !canAccess(user, task)) throw new HttpError(404, "task not found");
  return { user, task };
}

export function taskRouter(deps: AppDeps) {
  const router = Router();

  // Search & filters: ?q=text&status=todo&page=1&pageSize=20&scope=all (admin only)
  router.get("/", requireUser(deps), async (req, res) => {
    const user = authedUser(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : undefined;
    const status = req.query.status === undefined || req.query.status === "" ? undefined : parseStatus(req.query.status);
    const page = parseQueryInt(req.query.page, 1, 1, 10000);
    const pageSize = parseQueryInt(req.query.pageSize, 20, 1, 50);
    const allUsers = req.query.scope === "all" && user.role === "admin";
    const result = await repo.listTasks(deps.db, {
      userId: allUsers ? undefined : user.id,
      q: q || undefined,
      status,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({ ...result, page, pageSize });
  });

  router.post("/", requireUser(deps), async (req, res) => {
    const user = authedUser(req);
    const body = requireBody(req.body);
    const title = requiredString(body.title, "title", 200);
    const description = optionalString(body.description, "description", 2000) ?? "";
    const status = body.status === undefined ? "todo" : parseStatus(body.status);
    const task = await repo.insertTask(deps.db, { id: randomUUID(), title, description, status, createdBy: user.id });
    deps.events.publish({ type: "task.created", data: task });
    const newBadges = await refreshBadges(deps.db, user.id);
    res.status(201).json({ task, newBadges });
  });

  router.get("/:id", requireUser(deps), async (req, res) => {
    const { task } = await loadAccessibleTask(deps, req);
    res.json({ task });
  });

  router.patch("/:id", requireUser(deps), async (req, res) => {
    const { user, task } = await loadAccessibleTask(deps, req);
    const body = requireBody(req.body);
    const next: Task = {
      ...task,
      title: body.title === undefined ? task.title : requiredString(body.title, "title", 200),
      description:
        body.description === undefined ? task.description : (optionalString(body.description, "description", 2000) ?? ""),
      status: body.status === undefined ? task.status : parseStatus(body.status),
    };
    const saved = await repo.saveTask(deps.db, next);
    deps.events.publish({ type: "task.updated", data: saved });
    const newBadges = saved.status === "done" ? await refreshBadges(deps.db, user.id) : [];
    res.json({ task: saved, newBadges });
  });

  router.delete("/:id", requireUser(deps), async (req, res) => {
    const { task } = await loadAccessibleTask(deps, req);
    await repo.deleteTask(deps.db, task.id);
    deps.events.publish({ type: "task.deleted", data: { id: task.id } });
    res.status(204).end();
  });

  return router;
}
