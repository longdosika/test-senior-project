import { describe, expect, it } from "vitest";
import { scoreQuiz, validateQuiz } from "./quiz";

const q = (answerIndex: number) => ({ prompt: "p", choices: ["a", "b"], answerIndex });

describe("scoreQuiz", () => {
  it("counts correct answers and rounds the percentage", () => {
    expect(scoreQuiz([q(0), q(1), q(1)], [0, 0, 1])).toEqual({ score: 2, total: 3, percent: 67 });
  });

  it("treats missing or null answers as wrong", () => {
    expect(scoreQuiz([q(0), q(0)], [null])).toEqual({ score: 0, total: 2, percent: 0 });
  });

  it("returns 0 percent for a quiz with no questions", () => {
    expect(scoreQuiz([], [])).toEqual({ score: 0, total: 0, percent: 0 });
  });
});

describe("validateQuiz", () => {
  const valid = { title: " Basics ", questions: [{ prompt: "Q?", choices: ["x", "y"], answerIndex: 1 }] };

  it("accepts a well-formed quiz and trims text", () => {
    const result = validateQuiz(valid);
    expect(result).toEqual({
      ok: true,
      value: { title: "Basics", questions: [{ prompt: "Q?", choices: ["x", "y"], answerIndex: 1 }] },
    });
  });

  it("rejects an answer index outside the choices", () => {
    const result = validateQuiz({ title: "t", questions: [{ prompt: "Q", choices: ["x", "y"], answerIndex: 2 }] });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects missing title, empty question list and non-object input", () => {
    expect(validateQuiz({ ...valid, title: "" }).ok).toBe(false);
    expect(validateQuiz({ title: "t", questions: [] }).ok).toBe(false);
    expect(validateQuiz(null).ok).toBe(false);
  });
});
