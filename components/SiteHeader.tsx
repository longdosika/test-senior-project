"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, type Locale } from "../lib/i18n";
import { THEMES, type Theme } from "../lib/theme";
import { usePrefs } from "./Providers";

const NAV: Array<{ href: string; key: "nav.home" | "nav.account" | "nav.tasks" | "nav.quiz" | "nav.admin" }> = [
  { href: "/", key: "nav.home" },
  { href: "/account", key: "nav.account" },
  { href: "/tasks", key: "nav.tasks" },
  { href: "/quiz", key: "nav.quiz" },
  { href: "/admin", key: "nav.admin" },
];

const THEME_KEYS = { system: "theme.system", light: "theme.light", dark: "theme.dark" } as const;

export function SiteHeader() {
  const { t, theme, setTheme, locale, setLocale } = usePrefs();
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <nav className="site-nav" aria-label="เมนูหลัก">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="prefs">
          <label>
            {t("theme.label")}{" "}
            <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
              {THEMES.map((value) => (
                <option key={value} value={value}>
                  {t(THEME_KEYS[value])}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("locale.label")}{" "}
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((value) => (
                <option key={value} value={value} lang={value}>
                  {value === "th" ? "ไทย" : "English"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
