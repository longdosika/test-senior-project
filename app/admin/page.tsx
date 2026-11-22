"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, API_BASE, apiFetch, currentUser, type SessionUser } from "../../lib/api-client";
import { BADGE_IDS, BADGES, type BadgeId } from "../../lib/badges";
import { usePrefs } from "../../components/Providers";

type Stats = {
  users: number;
  tasks: { total: number; byStatus: { todo: number; doing: number; done: number } };
  quiz: { attempts: number; averagePercent: number };
  paidSatang: number;
};

type UserBadges = {
  user: SessionUser;
  badges: Array<{ id: BadgeId; title: string; description: string }>;
};

export default function AdminPage() {
  const { t } = usePrefs();
  const [state, setState] = useState<"checking" | "anonymous" | "forbidden" | "ready">("checking");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserBadges[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadBadges = useCallback(async () => {
    const res = await apiFetch<{ items: UserBadges[] }>("/api/admin/users");
    setUsers(res.items);
  }, []);

  useEffect(() => {
    let active = true;
    currentUser()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          setState("anonymous");
          return;
        }
        if (user.role !== "admin") {
          setState("forbidden");
          return;
        }
        const [s, list] = await Promise.all([
          apiFetch<Stats>("/api/admin/stats"),
          apiFetch<{ items: UserBadges[] }>("/api/admin/users"),
        ]);
        if (!active) return;
        setStats(s);
        setUsers(list.items);
        setState("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : t("common.error"));
        setState("anonymous");
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function downloadCsv() {
    setError(null);
    try {
      // Same-origin cookie is sent because of credentials: "include"; no token is read from JS.
      const res = await fetch(`${API_BASE}/api/admin/reports/tasks.csv`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "tasks-report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("common.error"));
    }
  }

  if (state === "checking") return <main id="main"><p>{t("common.loading")}</p></main>;
  if (state === "anonymous") {
    return (
      <main id="main">
        <h1>{t("admin.title")}</h1>
        <p>
          <Link href="/account">{t("account.login")}</Link>
        </p>
        {error && <p role="alert" className="error">{error}</p>}
      </main>
    );
  }
  if (state === "forbidden") {
    return (
      <main id="main">
        <h1>{t("admin.title")}</h1>
        <p role="alert" className="error">
          admin role required
        </p>
      </main>
    );
  }

  return (
    <main id="main">
      <h1>{t("admin.title")}</h1>
      {error && <p role="alert" className="error">{error}</p>}
      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat">
              {t("admin.users")}
              <strong>{stats.users}</strong>
            </div>
            <div className="stat">
              {t("admin.tasks")}
              <strong>{stats.tasks.total}</strong>
            </div>
            <div className="stat">
              {t("admin.done")}
              <strong>{stats.tasks.byStatus.done}</strong>
            </div>
          </div>
          <div className="card">
            <p>
              Quiz attempts: {stats.quiz.attempts} · average {stats.quiz.averagePercent}%
            </p>
            <p>Paid (THB): {(stats.paidSatang / 100).toFixed(2)}</p>
          </div>
        </>
      )}
      <button type="button" onClick={downloadCsv}>
        {t("admin.export")}
      </button>

      <section className="card" aria-labelledby="admin-badges-title" style={{ marginTop: 24 }}>
        <h2 id="admin-badges-title">{t("admin.badges.title")}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t("admin.badges.user")}</th>
                <th scope="col">{t("admin.badges.earned")}</th>
                <th scope="col">{t("admin.badges.grant")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => (
                <UserBadgeRow key={entry.user.id} entry={entry} onGranted={loadBadges} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/** One user: shows the badges they hold and a form to grant one more. */
function UserBadgeRow({ entry, onGranted }: { entry: UserBadges; onGranted: () => Promise<void> }) {
  const { t } = usePrefs();
  const [badgeId, setBadgeId] = useState<BadgeId>(BADGE_IDS[0]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const held = new Set(entry.badges.map((b) => b.id));

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ awarded: boolean }>(`/api/admin/users/${entry.user.id}/badges`, {
        method: "POST",
        json: { badgeId },
      });
      setMessage(res.awarded ? t("admin.badges.granted") : t("admin.badges.already"));
      if (res.awarded) await onGranted();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <th scope="row">
        {entry.user.displayName}
        <br />
        <span className="meta">{entry.user.email}</span>
      </th>
      <td>
        {entry.badges.length === 0 ? (
          t("admin.badges.none")
        ) : (
          <ul className="badge-list">
            {entry.badges.map((b) => (
              <li key={b.id} title={b.description}>
                {b.title}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td>
        <form className="stack" onSubmit={grant} aria-label={`${t("admin.badges.grant")}: ${entry.user.email}`}>
          <label className="field">
            <span className="visually-hidden">{t("admin.badges.select")}</span>
            <select value={badgeId} onChange={(e) => setBadgeId(e.target.value as BadgeId)} name="badgeId">
              {BADGE_IDS.map((id) => (
                <option key={id} value={id} disabled={held.has(id)}>
                  {BADGES[id].title}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            {t("admin.badges.grant")}
          </button>
          {message && <p role="status" className="meta">{message}</p>}
        </form>
      </td>
    </tr>
  );
}
