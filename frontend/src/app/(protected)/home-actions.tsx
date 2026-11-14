"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { HStack } from "@astryxdesign/core/HStack";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import BrandMark from "@/components/brand-mark";
import ThemeButton from "@/components/theme-button";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HomeActions() {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState("");

  async function signOut() {
    setError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <>
      <aside className="study-sidebar">
        <Link href="/" className="sidebar-brand">
          <BrandMark />
          <strong>수학 개념 체커</strong>
        </Link>
        <nav aria-label="주 메뉴" className="sidebar-nav">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
            <HomeIcon />
            학습하기
          </Link>
          <Link
            href="/history"
            aria-current={pathname.startsWith("/history") ? "page" : undefined}
          >
            <HistoryIcon />
            지난 기록
          </Link>
        </nav>
        <div className="sidebar-actions">
          <ThemeButton />
          <Button
            label="로그아웃"
            variant="ghost"
            onClick={signOut}
            icon={<LogoutIcon />}
          />
        </div>
      </aside>
      <header className="astryx-site-header protected-header">
        <TopNav
          label="주 메뉴"
          heading={
            <TopNavHeading
              logo={<BrandMark />}
              heading="수학 개념 체커"
              headingHref="/"
            />
          }
          endContent={
            <HStack gap={2} vAlign="center">
              {/* One button per action: icon + text; phones hide the text
                  (the label stays the accessible name), one header line. */}
              <Button
                label="지난 기록"
                variant="ghost"
                href="/history"
                icon={<HistoryIcon />}
              >
                <span className="site-nav-label">지난 기록</span>
              </Button>
              <Button
                label="로그아웃"
                variant="ghost"
                onClick={signOut}
                icon={<LogoutIcon />}
              >
                <span className="site-nav-label">로그아웃</span>
              </Button>
              <ThemeButton />
            </HStack>
          }
        />
      </header>
      {error && <Banner status="error" title={error} role="alert" />}
    </>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 10 9-7 9 7v10H3z" />
      <path d="M9 20v-7h6v7" />
    </svg>
  );
}
