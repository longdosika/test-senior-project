import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { Providers } from "../components/Providers";
import { THEME_STORAGE_KEY } from "../lib/theme";
import { buildMetadata } from "../lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  ...buildMetadata(),
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "Senior Project", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5fbf",
};

// Applies a saved light/dark override before first paint to avoid a theme flash.
const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          <a className="skip-link" href="#main">
            ข้ามไปยังเนื้อหาหลัก
          </a>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
