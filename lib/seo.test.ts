import { describe, expect, it } from "vitest";
import { buildMetadata, SITE_NAME } from "./seo";
import { metadata as layoutMetadata } from "../app/layout";

describe("SEO metadata", () => {
  it("builds a titled page with description, canonical and social tags", () => {
    const meta = buildMetadata({ title: "Tasks", description: "Manage tasks", path: "/tasks" });
    expect(meta.title).toBe(`Tasks · ${SITE_NAME}`);
    expect(meta.description).toBe("Manage tasks");
    expect(meta.alternates?.canonical).toBe("/tasks");
    expect((meta.openGraph as { title?: string }).title).toBe(`Tasks · ${SITE_NAME}`);
    expect(meta.robots).toMatchObject({ index: true, follow: true });
  });

  it("is used by the root layout", () => {
    expect(layoutMetadata.title).toBe(SITE_NAME);
    expect(layoutMetadata.description).toBeTruthy();
    expect(layoutMetadata.openGraph).toBeTruthy();
  });
});
