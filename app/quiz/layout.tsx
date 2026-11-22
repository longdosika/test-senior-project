import type { ReactNode } from "react";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({ title: "แบบทดสอบ", description: "Take quizzes and earn badges", path: "/quiz" });

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
