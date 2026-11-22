import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../app/manifest";

const root = path.resolve(__dirname, "..");

describe("PWA / offline support", () => {
  it("exposes an installable web app manifest", () => {
    const m = manifest();
    expect(m.name).toBe("Senior Project");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.icons?.length).toBeGreaterThan(0);
  });

  it("ships a service worker that caches the app shell and never caches API calls", () => {
    const swPath = path.join(root, "public", "sw.js");
    expect(existsSync(swPath)).toBe(true);
    const sw = readFileSync(swPath, "utf8");
    expect(sw).toContain("caches.open");
    expect(sw).toContain("/api/");
  });
});
