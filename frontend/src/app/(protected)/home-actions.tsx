"use client";

import { useRouter } from "next/navigation";
import { TopNav, TopNavHeading, TopNavItem } from "@astryxdesign/core/TopNav";
import { HStack } from "@astryxdesign/core/HStack";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import BrandMark from "@/components/brand-mark";
import ThemeButton from "@/components/theme-button";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function HomeActions() {
  const router = useRouter();
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
              <TopNavItem label="지난 기록" href="/history" />
              <Button label="로그아웃" variant="ghost" onClick={signOut} />
              <ThemeButton />
            </HStack>
          }
        />
      </header>
      {error && <Banner status="error" title={error} role="alert" />}
    </>
  );
}
