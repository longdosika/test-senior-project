import { describe, expect, it } from "vitest";
import { SPRINTS, countTasks, progressPercent, taskKey } from "./tasks";

describe("countTasks", () => {
  it("counts every task across the sprints", () => {
    expect(countTasks()).toBe(SPRINTS.reduce((n, s) => n + s.tasks.length, 0));
    expect(countTasks()).toBe(17);
  });

  it("returns 0 for an empty list", () => {
    expect(countTasks([])).toBe(0);
  });
});

describe("progressPercent", () => {
  it("is 0 when nothing is done", () => {
    expect(progressPercent(new Set())).toBe(0);
  });

  it("is 100 when everything is done", () => {
    const all = new Set<string>();
    for (const s of SPRINTS) s.tasks.forEach((_, i) => all.add(taskKey(s.id, i)));
    expect(progressPercent(all)).toBe(100);
  });

  it("rounds to a whole percentage", () => {
    // 1 of 17 tasks = 5.88% -> 6
    expect(progressPercent(new Set([taskKey("sprint-1", 0)]))).toBe(6);
  });

  it("ignores keys that do not match a task", () => {
    expect(progressPercent(new Set(["unknown:0", "sprint-1:99"]))).toBe(0);
  });

  it("returns 0 when there are no tasks", () => {
    expect(progressPercent(new Set(["x:0"]), [])).toBe(0);
  });
});
