import type { Metadata } from "next";
import { Suspense } from "react";
import { VariantProvider } from "./variant";
import "katex/dist/katex.min.css";
import "../../public/fonts/pretendard/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "수학 개념 체커",
  description: "수학 개념을 이해했는지 확인하는 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" data-variant="a" suppressHydrationWarning>
      <body>
        <Suspense fallback={children}>
          <VariantProvider>{children}</VariantProvider>
        </Suspense>
      </body>
    </html>
  );
}
