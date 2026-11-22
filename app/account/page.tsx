"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch, getStoredToken, setStoredToken } from "../../lib/api-client";
import { usePrefs } from "../../components/Providers";

type User = { id: string; email: string; displayName: string; role: "admin" | "user" };

export default function AccountPage() {
  const { t } = usePrefs();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    apiFetch<{ user: User }>("/api/auth/me", { token })
      .then((res) => setUser(res.user))
      .catch(() => setStoredToken(null));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
    };
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ user: User; token: string }>(
        mode === "register" ? "/api/auth/register" : "/api/auth/login",
        { method: "POST", json: body, token: null },
      );
      setStoredToken(res.token);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await apiFetch<void>("/api/auth/logout", { method: "POST" });
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  }

  if (user) {
    return (
      <main id="main">
        <h1>{t("account.title")}</h1>
        <div className="card">
          <p>
            <strong>{user.displayName}</strong>
            <br />
            {user.email} · {user.role}
          </p>
          <button type="button" className="secondary" onClick={logout}>
            {t("account.logout")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="main">
      <h1>{t("account.title")}</h1>
      <div className="card">
        <div role="group" aria-label="mode" className="stack" style={{ flexDirection: "row", gap: 8 }}>
          <button type="button" className={mode === "login" ? "" : "secondary"} aria-pressed={mode === "login"} onClick={() => setMode("login")}>
            {t("account.login")}
          </button>
          <button type="button" className={mode === "register" ? "" : "secondary"} aria-pressed={mode === "register"} onClick={() => setMode("register")}>
            {t("account.register")}
          </button>
        </div>
        <form className="stack" onSubmit={submit} style={{ marginTop: 16 }}>
          {mode === "register" && (
            <label className="field">
              {t("account.displayName")}
              <input name="displayName" type="text" required maxLength={80} autoComplete="name" />
            </label>
          )}
          <label className="field">
            {t("account.email")}
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label className="field">
            {t("account.password")}
            <input name="password" type="password" required minLength={8} autoComplete={mode === "register" ? "new-password" : "current-password"} />
          </label>
          <button type="submit" disabled={busy}>
            {mode === "register" ? t("account.register") : t("account.login")}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
