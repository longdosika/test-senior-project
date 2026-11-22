import { Router } from "express";
import { toCsv } from "../../lib/csv";
import type { AppDeps } from "../deps";
import { requireAdmin, requireUser } from "../middleware";
import * as repo from "../repo";

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

  return router;
}
