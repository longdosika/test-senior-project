import { describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, isTheme, readStoredTheme, themeAttribute, writeStoredTheme } from "./theme";

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
};

describe("theme", () => {
  it("maps system to no attribute so prefers-color-scheme applies", () => {
    expect(themeAttribute("system")).toBeNull();
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
  });

  it("persists and restores the chosen theme", () => {
    const store = memory();
    writeStoredTheme(store, "dark");
    expect(store.map.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme(store)).toBe("dark");
  });

  it("falls back to system for invalid stored values", () => {
    expect(readStoredTheme({ getItem: () => "neon" })).toBe("system");
    expect(isTheme("light")).toBe(true);
  });

  it("does not throw when storage is blocked", () => {
    const blocked = {
      getItem: vi.fn(() => {
        throw new Error("SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new Error("QuotaExceededError");
      }),
    };
    expect(readStoredTheme(blocked)).toBe("system");
    expect(() => writeStoredTheme(blocked, "dark")).not.toThrow();
    expect(readStoredTheme(undefined)).toBe("system");
  });
});
