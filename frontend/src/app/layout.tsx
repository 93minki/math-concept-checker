import type { Metadata } from "next";
import Script from "next/script";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script
          id="initial-theme"
          strategy="beforeInteractive"
        >{`try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`}</Script>
        <AppTheme>{children}</AppTheme>
      </body>
    </html>
  );
}
