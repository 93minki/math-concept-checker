"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw error;
      // The protected layout sends users who have not finished signup to /signup/complete.
      router.push("/");
      router.refresh();
    } catch {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function kakao() {
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError("카카오 로그인을 시작하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>로그인</h1>
      <form onSubmit={submit}>
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button disabled={busy} type="submit">로그인</button>
      </form>
      <button disabled={busy} onClick={kakao} type="button">카카오로 시작하기</button>
      <p>계정이 없나요? <Link href="/signup">회원가입</Link></p>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
