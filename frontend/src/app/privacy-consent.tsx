"use client";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";

export function rememberPrivacyConsent() {
  try {
    window.sessionStorage.setItem("privacy-consent", "agreed");
  } catch {
    // Storage may be unavailable; the current consent still permits proceeding.
  }
}

// Consent covers one signup; clear it once that signup completes.
export function clearPrivacyConsent() {
  try {
    window.sessionStorage.removeItem("privacy-consent");
  } catch {
    // Storage may be unavailable; nothing was stored then.
  }
}
export function hasPrivacyConsent() {
  try {
    return window.sessionStorage.getItem("privacy-consent") === "agreed";
  } catch {
    return false;
  }
}

export default function PrivacyConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <section className="privacy-consent">
      <h2>개인정보 수집·이용 동의</h2>
      <PrivacyConsentContent />
      <CheckboxInput
        label="개인정보 수집·이용에 동의합니다 (필수)"
        htmlName="privacy_consent"
        isRequired
        value={checked}
        onChange={onChange}
      />
    </section>
  );
}

export function PrivacyConsentContent() {
  return (
    <div
      className="privacy-consent-content"
      tabIndex={0}
      role="region"
      aria-label="개인정보 수집·이용 동의 내용"
    >
      <p>
        <strong>받는 정보</strong> — 이메일로 가입하면 이메일 주소. 카카오로
        가입하면 카카오가 보내 주는 닉네임·프로필 사진·이메일. 서비스를 쓰는
        동안 진단 기록(푼 답, 채점 결과, 리포트).
      </p>
      <p>
        <strong>쓰는 목적</strong> — 로그인, 진단 기록 저장과 다시 보기.
      </p>
      <p>
        <strong>맡기는 곳</strong> — 회원 정보와 진단 기록은
        Supabase(데이터베이스)에 저장해요. 서술형 답안 채점과 리포트 작성을 위해
        답안과 진단 결과를 OpenAI로 보내요.
      </p>
      <p>
        <strong>보관과 삭제</strong> — 탈퇴하거나 삭제를 요청할 때까지 보관하고,
        탈퇴하면 데이터베이스에서 삭제해요. 삭제 요청: 연락처는 서비스 공개 전에
        안내할 예정이에요.
      </p>
      <p>
        <strong>동의를 거부할 수 있어요</strong> — 다만 동의하지 않으면 가입할
        수 없어요.
      </p>
    </div>
  );
}
