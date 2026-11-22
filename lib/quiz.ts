export type QuizQuestionInput = { prompt: string; choices: string[]; answerIndex: number };
export type QuizInput = { title: string; questions: QuizQuestionInput[] };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_QUESTIONS = 50;
const MAX_CHOICES = 6;

/** Validates an untrusted quiz definition (e.g. from an admin's JSON request). */
export function validateQuiz(input: unknown): ValidationResult<QuizInput> {
  if (!input || typeof input !== "object") return { ok: false, error: "quiz must be an object" };
  const { title, questions } = input as { title?: unknown; questions?: unknown };
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 120) {
    return { ok: false, error: "title must be 1-120 characters" };
  }
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > MAX_QUESTIONS) {
    return { ok: false, error: `questions must contain 1-${MAX_QUESTIONS} items` };
  }
  const parsed: QuizQuestionInput[] = [];
  for (const [i, q] of questions.entries()) {
    if (!q || typeof q !== "object") return { ok: false, error: `question ${i + 1} must be an object` };
    const { prompt, choices, answerIndex } = q as Record<string, unknown>;
    if (typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 500) {
      return { ok: false, error: `question ${i + 1}: prompt must be 1-500 characters` };
    }
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > MAX_CHOICES) {
      return { ok: false, error: `question ${i + 1}: choices must contain 2-${MAX_CHOICES} items` };
    }
    if (!choices.every((c) => typeof c === "string" && c.trim().length > 0 && c.length <= 200)) {
      return { ok: false, error: `question ${i + 1}: every choice must be a non-empty string` };
    }
    if (!Number.isInteger(answerIndex) || (answerIndex as number) < 0 || (answerIndex as number) >= choices.length) {
      return { ok: false, error: `question ${i + 1}: answerIndex is out of range` };
    }
    parsed.push({ prompt: prompt.trim(), choices: choices.map((c) => (c as string).trim()), answerIndex: answerIndex as number });
  }
  return { ok: true, value: { title: title.trim(), questions: parsed } };
}

/**
 * Scores answers against questions. A missing or null answer counts as wrong.
 * `percent` is rounded to a whole number (0 when there are no questions).
 */
export function scoreQuiz(
  questions: ReadonlyArray<{ answerIndex: number }>,
  answers: ReadonlyArray<number | null | undefined>,
): { score: number; total: number; percent: number } {
  const total = questions.length;
  let score = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.answerIndex) score += 1;
  });
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  return { score, total, percent };
}
