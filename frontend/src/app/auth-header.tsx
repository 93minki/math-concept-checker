"use client";

import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { HStack } from "@astryxdesign/core/HStack";
import BrandMark from "@/components/brand-mark";
import ThemeButton from "@/components/theme-button";
import { usePathname } from "next/navigation";

export default function AuthHeader() {
  const pathname = usePathname();
  return (
    <header className="astryx-site-header">
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
            <TopNavItem
              href="/login"
              label="로그인"
              isSelected={pathname === "/login"}
            />
            <TopNavItem
              href="/signup"
              label="회원가입"
              isSelected={pathname === "/signup"}
            />
            <ThemeButton />
          </HStack>
        }
      />
    </header>
  );
}
