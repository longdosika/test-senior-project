"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, API_BASE, apiFetch, getStoredToken } from "../../lib/api-client";
import { usePrefs } from "../../components/Providers";

type Stats = {
  users: number;
  tasks: { total: number; byStatus: { todo: number; doing: number; done: number } };
  quiz: { attempts: number; averagePercent: number };
  paidSatang: number;
};

export default function AdminPage() {
  const { t } = usePrefs();
  const [state, setState] = useState<"checking" | "anonymous" | "forbidden" | "ready">("checking");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      setState("anonymous");
      return;
    }
    apiFetch<{ user: { role: string } }>("/api/auth/me")
      .then((res) => {
        if (res.user.role !== "admin") {
          setState("forbidden");
          return;
        }
        return apiFetch<Stats>("/api/admin/stats").then((s) => {
          setStats(s);
          setState("ready");
        });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : t("common.error"));
        setState("anonymous");
      });
  }, [t]);

  async function downloadCsv() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/reports/tasks.csv`, {
        headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` },
      });
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
    </main>
  );
}
