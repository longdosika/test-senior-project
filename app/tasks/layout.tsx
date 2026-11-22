import type { ReactNode } from "react";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({ title: "งานของฉัน", description: "Manage your tasks with live updates and search", path: "/tasks" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
