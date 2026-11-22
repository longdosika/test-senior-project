import type { Metadata } from "next";

export const SITE_NAME = "Senior Project";
export const SITE_DESCRIPTION = "ติดตามความคืบหน้า Senior Project ตาม sprint พร้อม spec และ documentation";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Builds page metadata with title, description, canonical URL and Open Graph / Twitter tags. */
export function buildMetadata(opts: { title?: string; description?: string; path?: string } = {}): Metadata {
  const title = opts.title ? `${opts.title} · ${SITE_NAME}` : SITE_NAME;
  const description = opts.description ?? SITE_DESCRIPTION;
  const path = opts.path ?? "/";
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, locale: "th_TH", type: "website" },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}
