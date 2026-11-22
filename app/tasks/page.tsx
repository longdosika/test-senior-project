"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiFetch, API_BASE, getStoredToken } from "../../lib/api-client";
import { connectRealtime } from "../../lib/realtime-client";
import { BADGES, type BadgeId } from "../../lib/badges";
import { usePrefs } from "../../components/Providers";

type Task = { id: string; title: string; description: string; status: "todo" | "doing" | "done"; createdBy: string };
type Page = { items: Task[]; total: number; page: number; pageSize: number };
type EarnedBadge = { id: BadgeId };

const STATUS_LABEL = { todo: "To do", doing: "Doing", done: "Done" } as const;

export default function TasksPage() {
  const { t } = usePrefs();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const res = await apiFetch<Page>(`/api/tasks?${params.toString()}`);
      setTasks(res.items);
      setTotal(res.total);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    }
  }, [q, status, t]);

  // Auth check, then keep the list in sync with server-pushed events.
  useEffect(() => {
    setAuthed(Boolean(getStoredToken()));
  }, []);

  useEffect(() => {
    if (!authed) return;
    const handle = setTimeout(() => void load(), 200); // debounce typing in the search box
    return () => clearTimeout(handle);
  }, [authed, load]);

  useEffect(() => {
    if (!authed) return;
    return connectRealtime({
      onStatus: setLive,
      onMessage: (msg) => {
        if (msg.type.startsWith("task.")) void load();
      },
    });
  }, [authed, load]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await apiFetch<{ newBadges: Array<{ id: BadgeId }> }>("/api/tasks", {
        method: "POST",
        json: { title: String(data.get("title") ?? ""), description: String(data.get("description") ?? "") },
      });
      form.reset();
      announceBadges(res.newBadges);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    }
  }

  async function changeStatus(task: Task, next: Task["status"]) {
    try {
      const res = await apiFetch<{ newBadges: Array<{ id: BadgeId }> }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        json: { status: next },
      });
      announceBadges(res.newBadges);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    }
  }

  async function removeTask(task: Task) {
    try {
      await apiFetch<void>(`/api/tasks/${task.id}`, { method: "DELETE" });
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await apiFetch<{ file: { filename: string }; newBadges: Array<{ id: BadgeId }> }>("/api/files", {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      setMessage(`อัปโหลดแล้ว: ${res.file.filename}`);
      announceBadges(res.newBadges);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function announceBadges(badges: Array<{ id: BadgeId }>) {
    if (badges.length) {
      setMessage(`ได้รับเหรียญ: ${badges.map((b) => BADGES[b.id].title).join(", ")}`);
    }
  }

  if (authed === false) {
    return (
      <main id="main">
        <h1>{t("tasks.title")}</h1>
        <p>
          <Link href="/account">{t("account.login")}</Link>
        </p>
      </main>
    );
  }

  return (
    <main id="main">
      <h1>{t("tasks.title")}</h1>
      <p className="meta">
        <span className="live-dot" data-live={live} aria-hidden="true" />
        {t("tasks.live")} · {total}
      </p>

      <div className="stack" role="status" aria-live="polite">
        {message && <p>{message}</p>}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <section aria-labelledby="new-task" className="card">
        <h2 id="new-task">{t("tasks.add")}</h2>
        <form className="stack" onSubmit={createTask}>
          <label className="field">
            Title
            <input name="title" type="text" required maxLength={200} />
          </label>
          <label className="field">
            Description
            <textarea name="description" rows={3} maxLength={2000} />
          </label>
          <button type="submit">{t("tasks.add")}</button>
        </form>
      </section>

      <section aria-labelledby="filters" className="card">
        <h2 id="filters">{t("tasks.search")}</h2>
        <div className="stack task-filters">
          <label className="field">
            {t("tasks.search")}
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="field">
            {t("tasks.filter")}
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("tasks.all")}</option>
              <option value="todo">To do</option>
              <option value="doing">Doing</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="list-title">
        <h2 id="list-title">{t("tasks.title")}</h2>
        {tasks.length === 0 && <p className="meta">{t("tasks.empty")}</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {tasks.map((task) => (
            <li key={task.id} className="task-row">
              <div>
                <strong>{task.title}</strong>
                {task.description && <p className="meta" style={{ margin: 0 }}>{task.description}</p>}
              </div>
              <div className="task-row__actions">
                <label>
                  <span className="meta">{t("tasks.filter")}: </span>
                  <select
                    aria-label={`Status of ${task.title}`}
                    value={task.status}
                    onChange={(e) => changeStatus(task, e.target.value as Task["status"])}
                  >
                    {(Object.keys(STATUS_LABEL) as Task["status"][]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="danger" onClick={() => removeTask(task)} aria-label={`Delete ${task.title}`}>
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="upload-title" className="card">
        <h2 id="upload-title">{t("tasks.upload")}</h2>
        <label className="field">
          <span className="meta">PNG, JPEG, PDF, TXT · max 5 MB</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,application/pdf,text/plain"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
        </label>
      </section>
      <p className="meta">API: {API_BASE}</p>
    </main>
  );
}
