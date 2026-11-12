"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import PrivacyConsent, {
  hasPrivacyConsent,
  rememberPrivacyConsent,
} from "../../privacy-consent";

export default function CompleteSignup() {
  const { push, refresh } = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consent, setConsent] = useState(false);

  const complete = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session) throw new Error("No session");
      // F-11: 연령 확인·보호자 동의 단계는 여기(백엔드 check_signup_requirements)에 들어간다.
      const response = await fetch(
        `${publicEnv.NEXT_PUBLIC_API_BASE_URL}/signup/complete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (!response.ok) throw new Error("Signup incomplete");
      push("/");
      refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }, [push, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hasPrivacyConsent()) void complete();
      else {
        setBusy(false);
        setNeedsConsent(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [complete]);

  return (
    <main className="auth-card">
      <h1>가입 마무리</h1>
      {busy && <p>가입을 마무리하고 있어요.</p>}
      {needsConsent && (
        <>
          <p>가입을 마치려면 개인정보 수집·이용에 동의해 주세요.</p>
          <PrivacyConsent checked={consent} onChange={setConsent} />
          <button
            className="btn"
            type="button"
            disabled={!consent}
            onClick={() => {
              if (!consent) return;
              rememberPrivacyConsent();
              setNeedsConsent(false);
              setBusy(true);
              void complete();
            }}
          >
            동의하고 가입 마치기
          </button>
        </>
      )}
      {error && (
        <>
          <p role="alert">가입을 마무리하지 못했어요. 다시 시도해 주세요.</p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setBusy(true);
              setError(false);
              void complete();
            }}
          >
            다시 시도
          </button>
        </>
      )}
    </main>
  );
}
