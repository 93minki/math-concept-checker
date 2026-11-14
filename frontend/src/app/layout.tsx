import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import AppTheme from "@/components/app-theme";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "katex/dist/katex.min.css";
import "../../public/fonts/pretendard/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "수학 개념 체커",
  description: "수학 개념을 이해했는지 확인하는 서비스",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const stored = (await cookies()).get("theme")?.value;
  const initialMode =
    stored === "light" || stored === "dark" ? stored : "system";
  return (
    <html
      lang="ko"
      data-theme={initialMode === "system" ? undefined : initialMode}
      suppressHydrationWarning
    >
      <body>
        <Script
          id="initial-theme"
          strategy="beforeInteractive"
        >{String.raw`try{var c=document.cookie.match(/(?:^|;\s*)theme=(light|dark)(?:;|$)/);if(!c){var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.cookie="theme="+t+"; path=/; max-age=31536000; SameSite=Lax";document.documentElement.dataset.theme=t}}}catch(e){}`}</Script>
        <AppTheme initialMode={initialMode}>{children}</AppTheme>
      </body>
    </html>
  );
}
