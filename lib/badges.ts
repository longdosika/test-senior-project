export const BADGE_IDS = ["first-task", "finisher", "quiz-taker", "perfect-score", "uploader"] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export const BADGES: Record<BadgeId, { title: string; description: string }> = {
  "first-task": { title: "First Step", description: "Created your first task" },
  finisher: { title: "Finisher", description: "Completed 5 tasks" },
  "quiz-taker": { title: "Quiz Taker", description: "Submitted a quiz attempt" },
  "perfect-score": { title: "Perfect Score", description: "Scored 100% on a quiz" },
  uploader: { title: "Uploader", description: "Uploaded a file" },
};

export type BadgeStats = {
  tasksTotal: number;
  tasksDone: number;
  quizAttempts: number;
  bestQuizPercent: number;
  uploads: number;
};

/** Pure rule set: which badges a user has earned given their activity stats. */
export function computeBadges(stats: BadgeStats): BadgeId[] {
  const earned: BadgeId[] = [];
  if (stats.tasksTotal >= 1) earned.push("first-task");
  if (stats.tasksDone >= 5) earned.push("finisher");
  if (stats.quizAttempts >= 1) earned.push("quiz-taker");
  if (stats.bestQuizPercent >= 100) earned.push("perfect-score");
  if (stats.uploads >= 1) earned.push("uploader");
  return earned;
}

export function isBadgeId(value: string): value is BadgeId {
  return (BADGE_IDS as readonly string[]).includes(value);
}
