"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
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
      router.push("/login");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <>
      <div className="button-row">
        <button onClick={signOut}>로그아웃</button>
        <Link className="study-link" href="/history">
          지난 기록
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
