"use client";

import Link from "next/link";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { VStack } from "@astryxdesign/core/VStack";
import { Banner } from "@astryxdesign/core/Banner";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import PrivacyConsent, { rememberPrivacyConsent } from "../privacy-consent";

export default function SignupPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) return;
    rememberPrivacyConsent();
    setBusy(true);
    setMessage("");
    setError("");
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

  // Kakao asks for consent on /signup/complete, same as the login page
  // (user 2026-11-14: the button must not wait for the email form's checkbox).
  async function kakao() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch {
      setError("카카오로 시작하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <Card>
        <VStack gap={4}>
          <h1>회원가입</h1>
          <Button
            label="카카오로 시작하기"
            variant="secondary"
            isDisabled={busy || !hydrated}
            onClick={kakao}
            width="100%"
          />
          <p className="auth-divider">또는 이메일로 가입</p>
          {/* method="post": a native submit must never put the password in the URL. */}
          <form className="auth-form" method="post" onSubmit={submit}>
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
            <PrivacyConsent checked={consent} onChange={setConsent} />
            <button
              className="btn"
              disabled={busy || !hydrated || !consent}
              type="submit"
            >
              가입하기
            </button>
          </form>
          <p>
            이미 계정이 있나요? <Link href="/login">로그인</Link>
          </p>
          {message && <Banner status="info" title={message} role="status" />}
          {error && <Banner status="error" title={error} role="alert" />}
        </VStack>
      </Card>
    </main>
  );
}
