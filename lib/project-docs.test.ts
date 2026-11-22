import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("project documentation", () => {
  it("keeps the spec in CLAUDE.md with the 18 required features", () => {
    const spec = read("CLAUDE.md");
    const section = spec.slice(spec.indexOf("## ✨ Features Required"), spec.indexOf("## 📐 Database Schema"));
    expect(section.match(/- \[ \] \*\*/g)?.length).toBe(18);
  });

  it("documents the AI workflow used to build the project", () => {
    expect(existsSync(path.join(root, "docs", "AI_WORKFLOW.md"))).toBe(true);
  });

  it("README follows the spec template with Features and Stack sections", () => {
    const readme = read("README.md");
    expect(readme).toContain("## Features");
    expect(readme).toContain("## Tech Stack");
    expect(readme).toContain("Next.js");
    expect(readme).toContain("Express");
    expect(readme).toContain("PostgreSQL");
  });

  it("ignores local env files and uploads so secrets are never committed", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toMatch(/^\.env\*\.local$/m);
    expect(gitignore).toMatch(/^uploads\/$/m);
  });
});
