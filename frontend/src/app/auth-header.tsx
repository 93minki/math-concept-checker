"use client";

import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import ThemeButton from "@/components/theme-button";
import { usePathname } from "next/navigation";

export default function AuthHeader() {
  const pathname = usePathname();
  return (
    <header className="home-header auth-header">
      <div className="home-header-inner">
        <Link className="home-brand" href="/">
          <BrandMark />
          수학 개념 체커
        </Link>
        <div className="auth-header-actions">
          <Link
            href="/login"
            className="btn btn-secondary"
            aria-current={pathname === "/login" ? "page" : undefined}
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="btn"
            aria-current={pathname === "/signup" ? "page" : undefined}
          >
            회원가입
          </Link>
          <ThemeButton />
        </div>
      </div>
    </header>
  );
}
