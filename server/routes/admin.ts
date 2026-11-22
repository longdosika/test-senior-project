import { Router } from "express";
import { BADGES, isBadgeId } from "../../lib/badges";
import { toCsv } from "../../lib/csv";
import type { AppDeps } from "../deps";
import { HttpError, requiredString, requireBody } from "../http";
import { requireAdmin, requireUser } from "../middleware";
import * as repo from "../repo";
import { grantBadge } from "../services/badges";

export function adminRouter(deps: AppDeps) {
  const router = Router();
  router.use(requireUser(deps), requireAdmin);

  // Analytics for the admin dashboard.
  router.get("/stats", async (_req, res) => {
    const [users, tasks, quiz, paidSatang] = await Promise.all([
      repo.userCount(deps.db),
      repo.taskCounts(deps.db),
      repo.allQuizAverage(deps.db),
      repo.paidTotalSatang(deps.db),
    ]);
    res.json({
      users,
      tasks: { total: tasks.total, byStatus: tasks.byStatus },
      quiz,
      paidSatang,
    });
  });

  // Reporting: CSV export of all tasks with their owners.
  router.get("/reports/tasks.csv", async (_req, res) => {
    const rows = await repo.allTasksForExport(deps.db);
    const csv = toCsv(
      ["id", "title", "status", "owner_email", "created_at", "updated_at"],
      rows.map((t) => [t.id, t.title, t.status, t.ownerEmail, t.createdAt, t.updatedAt]),
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="tasks-report.csv"');
    res.send(csv);
  });

  // Gamification: list every user with the badges they hold.
  router.get("/users", async (_req, res) => {
    const rows = await repo.usersWithBadges(deps.db);
    res.json({
      items: rows.map(({ user, badgeIds }) => ({
        user,
        badges: badgeIds.filter(isBadgeId).map((id) => ({ id, ...BADGES[id] })),
      })),
    });
  });

  // Gamification: grant a badge by hand. 201 when newly awarded, 200 when the user already had it.
  router.post("/users/:id/badges", async (req, res) => {
    const body = requireBody(req.body);
    const badgeId = requiredString(body.badgeId, "badgeId", 40);
    if (!isBadgeId(badgeId)) throw new HttpError(400, "unknown badgeId");
    const userId = String(req.params.id);
    if (!(await repo.findUserById(deps.db, userId))) throw new HttpError(404, "user not found");
    const { awarded } = await grantBadge(deps.db, userId, badgeId);
    res.status(awarded ? 201 : 200).json({ awarded, badge: { id: badgeId, ...BADGES[badgeId] } });
  });

  return router;
}
