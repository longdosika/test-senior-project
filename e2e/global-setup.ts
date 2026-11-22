import { ADMIN_EMAIL, ADMIN_NAME, QUIZ_TITLE, apiJson, sessionFor } from "./support";

/**
 * Runs once after the servers are up. Creates the admin account (listed in ADMIN_EMAILS) and
 * one quiz with known answers, so the student flow has something to take.
 */
export default async function globalSetup() {
  const admin = await sessionFor(ADMIN_EMAIL, ADMIN_NAME);
  const existing = await apiJson("/api/quizzes", { cookie: admin.cookie });
  const already = (existing.data.items as Array<{ title: string }>).some((q) => q.title === QUIZ_TITLE);
  if (already) return;

  const created = await apiJson("/api/quizzes", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      title: QUIZ_TITLE,
      questions: [
        { prompt: "How long is a sprint?", choices: ["1 week", "2 weeks", "1 month"], answerIndex: 1 },
        { prompt: "Who owns the backlog?", choices: ["Developer", "Product Owner"], answerIndex: 1 },
      ],
    },
  });
  if (created.status !== 201) throw new Error(`quiz seed failed: ${created.status} ${JSON.stringify(created.data)}`);
}
