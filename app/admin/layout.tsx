import type { ReactNode } from "react";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({ title: "แดชบอร์ดแอดมิน", description: "Admin analytics and CSV reports", path: "/admin" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
