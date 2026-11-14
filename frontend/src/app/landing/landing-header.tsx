import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import BrandMark from "@/components/brand-mark";
import ThemeButton from "@/components/theme-button";
export default function LandingHeader() {
  return (
    <header className="landing-header">
      <nav aria-label="주 메뉴" className="landing-header-inner">
        <Link href="/" className="landing-brand">
          <BrandMark />
          <strong>수학 개념 체크</strong>
        </Link>
        <div className="landing-nav">
          <Link href="/login" className="landing-login">
            로그인
          </Link>
          <Button label="회원가입" variant="primary" size="lg" href="/signup" />
          <ThemeButton />
        </div>
      </nav>
    </header>
  );
}
