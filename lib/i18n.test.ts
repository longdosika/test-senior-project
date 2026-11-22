import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, MESSAGES, isLocale, translate, type MessageKey } from "./i18n";

describe("i18n messages", () => {
  it("has exactly the same keys in every locale", () => {
    const keys = (locale: keyof typeof MESSAGES) => Object.keys(MESSAGES[locale]).sort();
    expect(keys("en")).toEqual(keys("th"));
  });

  it("has no empty translations", () => {
    for (const locale of LOCALES) {
      for (const value of Object.values(MESSAGES[locale])) expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it("translates a key into the requested locale", () => {
    const key: MessageKey = "nav.home";
    expect(translate("en", key)).toBe("Home");
    expect(translate("th", key)).toBe("หน้าหลัก");
    expect(DEFAULT_LOCALE).toBe("th");
  });

  it("validates locale values", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
