"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthHeader() {
  const pathname = usePathname();
  return (
    <header className="home-header auth-header">
      <div className="home-header-inner">
        <Link className="home-brand" href="/">
          수학 개념 체커
        </Link>
        <div className="auth-header-actions">
          <Link
            href="/login?login=1"
            scroll={false}
            className="btn btn-secondary"
            aria-current={pathname === "/login" ? "page" : undefined}
            data-login-trigger
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
        </div>
      </div>
    </header>
  );
}
