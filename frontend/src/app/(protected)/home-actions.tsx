"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
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
    <header className="home-header">
      <div className="home-header-inner">
        <Link className="home-brand" href="/">
          <BrandMark />
          수학 개념 체커
        </Link>
        <nav className="home-nav" aria-label="주 메뉴">
          <Link href="/history">지난 기록</Link>
          <button onClick={signOut}>로그아웃</button>
        </nav>
      </div>
      {error && <p role="alert">{error}</p>}
    </header>
  );
}
