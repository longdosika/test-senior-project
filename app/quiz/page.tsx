"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch, currentUser } from "../../lib/api-client";
import { BADGES, type BadgeId } from "../../lib/badges";
import { usePrefs } from "../../components/Providers";

type QuizSummary = { id: string; title: string; questionCount: number };
type Quiz = { id: string; title: string; questions: Array<{ id: string; prompt: string; choices: string[] }> };
type Result = { score: number; total: number; percent: number; newBadges: Array<{ id: BadgeId; title: string }> };

export default function QuizPage() {
  const { t } = usePrefs();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    currentUser()
      .then(async (user) => {
        if (!active) return;
        setAuthed(Boolean(user));
        if (!user) return;
        const res = await apiFetch<{ items: QuizSummary[] }>("/api/quizzes");
        if (active) setQuizzes(res.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : t("common.error"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function open(id: string) {
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      setQuiz(await apiFetch<Quiz>(`/api/quizzes/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quiz) return;
    const ordered = quiz.questions.map((q) => (q.id in answers ? answers[q.id] : null));
    try {
      const res = await apiFetch<Result>(`/api/quizzes/${quiz.id}/attempts`, {
        method: "POST",
        json: { answers: ordered },
      });
      setResult({ ...res, newBadges: res.newBadges.map((b) => ({ ...b, title: BADGES[b.id].title })) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    }
  }

  if (authed === false) {
    return (
      <main id="main">
        <h1>{t("quiz.title")}</h1>
        <p>
          <Link href="/account">{t("account.login")}</Link>
        </p>
      </main>
    );
  }

  return (
    <main id="main">
      <h1>{t("quiz.title")}</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {!quiz && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {quizzes.length === 0 && <li className="meta">—</li>}
          {quizzes.map((item) => (
            <li key={item.id} className="card">
              <h2>{item.title}</h2>
              <p className="meta">{item.questionCount} questions</p>
              <button type="button" onClick={() => open(item.id)}>
                {t("quiz.title")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {quiz && !result && (
        <form onSubmit={submit} className="stack">
          <h2>{quiz.title}</h2>
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id}>
              <legend>
                {i + 1}. {q.prompt}
              </legend>
              {q.choices.map((choice, ci) => (
                <label key={ci}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === ci}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: ci }))}
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <button type="submit">{t("quiz.submit")}</button>
        </form>
      )}

      {result && (
        <section className="card" aria-live="polite">
          <h2>
            {t("quiz.score")}: {result.score} / {result.total} ({result.percent}%)
          </h2>
          {result.newBadges.length > 0 && (
            <>
              <p>New badges</p>
              <ul className="badge-list">
                {result.newBadges.map((b) => (
                  <li key={b.id}>{b.title}</li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="secondary" onClick={() => { setQuiz(null); setResult(null); }}>
            ← {t("quiz.title")}
          </button>
        </section>
      )}
    </main>
  );
}
