"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";

export default function SignupPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const { data, error } = await createClient().auth.signUp({
        email: String(form.get("email")),
        password: String(form.get("password")),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      if (data.session) {
        router.push("/signup/complete");
        router.refresh();
        return;
      }
      setMessage("확인 메일을 보냈어요. 메일의 링크를 눌러 주세요.");
    } catch {
      setMessage("가입하지 못했어요. 입력한 내용을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-card">
      <h1>회원가입</h1>
      {/* method="post": a native submit must never put the password in the URL. */}
      <form method="post" onSubmit={submit}>
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
        <button className="btn" disabled={busy || !hydrated} type="submit">
          가입하기
        </button>
      </form>
      <p>
        이미 계정이 있나요? <Link href="/login">로그인</Link>
      </p>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
