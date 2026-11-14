"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { PrivacyConsentContent } from "@/app/privacy-consent";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/diagnosis-api";
import { useHydrated } from "@/lib/use-hydrated";

type AccountInfo = { email: string; createdAt: string; kakao: boolean };
export default function AccountPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [terms, setTerms] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data.user) {
          setLoadError(true);
          return;
        }
        setInfo({
          email: data.user.email ?? "",
          createdAt: data.user.created_at,
          kakao: data.user.app_metadata.provider === "kakao",
        });
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!info?.email || !current || password.length < 6 || password !== repeat)
      return;
    setBusy(true);
    setMessage("");
    try {
      const auth = createClient().auth;
      const checked = await auth.signInWithPassword({
        email: info.email,
        password: current,
      });
      if (checked.error) {
        setMessage("현재 비밀번호가 맞지 않아요");
        return;
      }
      const updated = await auth.updateUser({
        password,
        current_password: current,
      });
      if (updated.error) throw updated.error;
      setCurrent("");
      setPassword("");
      setRepeat("");
      setMessage("비밀번호를 바꿨어요");
    } catch {
      setMessage("비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    setDeleteError("");
    try {
      await deleteAccount();
    } catch {
      setDeleteError("탈퇴하지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    await createClient()
      .auth.signOut()
      .catch(() => {});
    router.push("/");
    router.refresh();
  }
  const joined = info ? new Date(info.createdAt) : null;
  return (
    <main className="study-page account-page">
      <h1>내 정보</h1>
      {loadError && (
        <p role="alert">계정 정보를 불러오지 못했어요. 새로고침해 주세요.</p>
      )}
      {info && (
        <>
          <section className="stack">
            <h2>계정</h2>
            <Card>
              <dl className="account-details">
                <dt>가입 방식</dt>
                <dd>{info.kakao ? "카카오" : "이메일"}</dd>
                <dt>이메일</dt>
                <dd>{info.email || "이메일 없음"}</dd>
                <dt>가입일</dt>
                <dd>
                  {joined &&
                    `${joined.getFullYear()}년 ${joined.getMonth() + 1}월 ${joined.getDate()}일`}
                </dd>
              </dl>
            </Card>
          </section>
          <section className="stack">
            <h2>약관 다시 보기</h2>
            <Button
              label="동의 내용 보기"
              variant="secondary"
              size="lg"
              onClick={() => setTerms(true)}
            />
          </section>
          {!info.kakao && (
            <section className="stack">
              <h2>비밀번호 변경</h2>
              <form
                className="auth-form"
                method="post"
                onSubmit={changePassword}
              >
                <label htmlFor="current-password">현재 비밀번호</label>
                <input
                  id="current-password"
                  type="password"
                  name="current_password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                />
                <label htmlFor="new-password">새 비밀번호</label>
                <input
                  id="new-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label htmlFor="repeat-password">새 비밀번호 확인</label>
                <input
                  id="repeat-password"
                  type="password"
                  name="password_confirmation"
                  autoComplete="new-password"
                  minLength={6}
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={
                    !hydrated ||
                    busy ||
                    !current ||
                    password.length < 6 ||
                    password !== repeat
                  }
                >
                  변경
                </button>
              </form>
              {message && <p role="status">{message}</p>}
            </section>
          )}
          <section className="stack">
            <h2>회원 탈퇴</h2>
            <Button
              label="회원 탈퇴"
              variant="destructive"
              size="lg"
              onClick={() => {
                setDeleteError("");
                setConfirm(true);
              }}
            />
          </section>
        </>
      )}
      <Dialog
        isOpen={terms}
        onOpenChange={setTerms}
        purpose="info"
        // The consent text is long; the 400px default clipped it (user 2026-11-14).
        width={640}
        maxHeight="85dvh"
      >
        <Layout
          header={<DialogHeader title="개인정보 수집·이용 동의" />}
          content={
            <LayoutContent>
              <PrivacyConsentContent />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <Button
                label="닫기"
                variant="secondary"
                onClick={() => setTerms(false)}
              />
            </LayoutFooter>
          }
        />
      </Dialog>
      <Dialog
        isOpen={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
        purpose="info"
        width={480}
      >
        <Layout
          header={<DialogHeader title="정말 탈퇴하시겠어요?" />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                <p>탈퇴하면 진단 기록이 모두 사라지고 되돌릴 수 없어요.</p>
                {deleteError && <p role="alert">{deleteError}</p>}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="secondary"
                  isDisabled={busy}
                  onClick={() => setConfirm(false)}
                />
                <Button
                  label="탈퇴"
                  variant="destructive"
                  isDisabled={busy}
                  isLoading={busy}
                  onClick={() => void withdraw()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </main>
  );
}
