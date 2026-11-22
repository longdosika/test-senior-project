import { test as base, expect } from "@playwright/test";

/** Every flow runs in English so the selectors are stable (the app defaults to Thai). */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("senior-project-locale", "en");
      } catch {
        // storage blocked: the default locale is used
      }
    });
    await use(page);
  },
});

export { expect };
