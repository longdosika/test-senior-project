import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/account", "/tasks", "/quiz"];
  return paths.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.6 }));
}
