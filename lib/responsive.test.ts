import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "..", "app", "globals.css"), "utf8");

describe("responsive, mobile-first CSS", () => {
  it("uses min-width media queries only (mobile-first)", () => {
    expect(css).toContain("@media (min-width:");
    expect(css).not.toMatch(/@media \(max-width/);
  });

  it("keeps a 16px side gutter on the main column", () => {
    expect(css).toMatch(/main\s*\{[^}]*padding:\s*24px 16px/);
  });

  it("supports dark mode via data-theme and the system preference", () => {
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("prefers-color-scheme: dark");
  });
});
