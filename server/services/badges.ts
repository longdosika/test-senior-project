import type { Pool } from "pg";
import { computeBadges, type BadgeId } from "../../lib/badges";
import * as repo from "../repo";

/**
 * Recomputes a user's badge stats, awards any newly earned badges and returns them.
 * Already-held badges are never re-awarded.
 */
export async function refreshBadges(db: Pool, userId: string): Promise<BadgeId[]> {
  const [tasks, quiz, uploads] = await Promise.all([
    repo.taskCounts(db, userId),
    repo.quizAttemptStats(db, userId),
    repo.countFilesByOwner(db, userId),
  ]);
  const earned = computeBadges({
    tasksTotal: tasks.total,
    tasksDone: tasks.done,
    quizAttempts: quiz.attempts,
    bestQuizPercent: quiz.bestPercent,
    uploads,
  });
  const newlyAwarded: BadgeId[] = [];
  for (const id of earned) {
    if (await repo.awardBadge(db, userId, id)) newlyAwarded.push(id);
  }
  return newlyAwarded;
}
