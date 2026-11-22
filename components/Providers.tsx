"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, translate, type Locale, type MessageKey } from "../lib/i18n";
import { readStoredTheme, themeAttribute, writeStoredTheme, type Theme } from "../lib/theme";

const LOCALE_STORAGE_KEY = "senior-project-locale";

type Prefs = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  t: (key: MessageKey) => string;
};

const PrefsContext = createContext<Prefs | null>(null);

function localStorageOrUndefined(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Holds language and theme preferences; applies them to <html> and registers the service worker. */
export function Providers({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const storage = localStorageOrUndefined();
    let savedLocale: string | null = null;
    try {
      savedLocale = storage?.getItem(LOCALE_STORAGE_KEY) ?? null;
    } catch {
      savedLocale = null;
    }
    if (isLocale(savedLocale)) setLocaleState(savedLocale);
    setThemeState(readStoredTheme(storage));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const attr = themeAttribute(theme);
    if (attr) document.documentElement.setAttribute("data-theme", attr);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // offline support is best-effort
      });
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorageOrUndefined()?.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeStoredTheme(localStorageOrUndefined(), next);
  }, []);

  const value = useMemo<Prefs>(
    () => ({ locale, setLocale, theme, setTheme, t: (key) => translate(locale, key) }),
    [locale, setLocale, theme, setTheme],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <Providers>");
  return ctx;
}
