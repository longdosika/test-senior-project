export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "senior-project-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Value for the `data-theme` attribute on <html>. `system` returns null, which
 * removes the attribute so the CSS `prefers-color-scheme` rules apply.
 */
export function themeAttribute(theme: Theme): "light" | "dark" | null {
  return theme === "system" ? null : theme;
}

/** Reads the saved theme; any storage failure (private mode, blocked) falls back to `system`. */
export function readStoredTheme(storage: Pick<Storage, "getItem"> | undefined): Theme {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function writeStoredTheme(storage: Pick<Storage, "setItem"> | undefined, theme: Theme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this page view.
  }
}
