import type { ReactNode } from "react";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({ title: "บัญชีผู้ใช้", description: "Register and log in", path: "/account" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
