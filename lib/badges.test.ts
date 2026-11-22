import { describe, expect, it } from "vitest";
import { BADGE_IDS, BADGES, computeBadges, isBadgeId } from "./badges";

const none = { tasksTotal: 0, tasksDone: 0, quizAttempts: 0, bestQuizPercent: 0, uploads: 0 };

describe("computeBadges", () => {
  it("awards nothing to a new user", () => {
    expect(computeBadges(none)).toEqual([]);
  });

  it("awards each badge at its threshold", () => {
    expect(computeBadges({ ...none, tasksTotal: 1 })).toEqual(["first-task"]);
    expect(computeBadges({ ...none, tasksTotal: 5, tasksDone: 4 })).toEqual(["first-task"]);
    expect(computeBadges({ ...none, tasksTotal: 5, tasksDone: 5 })).toEqual(["first-task", "finisher"]);
    expect(computeBadges({ ...none, quizAttempts: 1, bestQuizPercent: 100 })).toEqual(["quiz-taker", "perfect-score"]);
    expect(computeBadges({ ...none, uploads: 1 })).toEqual(["uploader"]);
  });

  it("does not award perfect-score below 100%", () => {
    expect(computeBadges({ ...none, quizAttempts: 1, bestQuizPercent: 99 })).not.toContain("perfect-score");
  });
});

describe("badge catalogue", () => {
  it("has a title and description for every id", () => {
    for (const id of BADGE_IDS) {
      expect(BADGES[id].title.length).toBeGreaterThan(0);
      expect(BADGES[id].description.length).toBeGreaterThan(0);
    }
    expect(isBadgeId("finisher")).toBe(true);
    expect(isBadgeId("made-up")).toBe(false);
  });
});
