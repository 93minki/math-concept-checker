"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { ApiError } from "@/lib/diagnosis-api";
import { ReportKindOptions } from "./report-kind-options";
import { reportQuestion, type ReportKind } from "@/lib/reports-api";
export function FlagIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 21V4m0 1c6-4 9 4 15 0v10c-6 4-9-4-15 0" />
    </svg>
  );
}
export default function ReportButton({ itemId }: { itemId: number }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind | "">("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setKind("");
      setDescription("");
      setMessage("");
      setSuccess(false);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [success]);
  function close() {
    if (busy) return;
    setOpen(false);
    setKind("");
    setDescription("");
    setMessage("");
    setSuccess(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kind || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await reportQuestion(itemId, kind, description);
      setSuccess(true);
      setMessage("신고가 접수됐어요");
    } catch (e) {
      setMessage(
        e instanceof ApiError && e.status === 409
          ? "이미 신고한 문제예요"
          : "신고하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        label="오류 신고"
        variant="secondary"
        size="lg"
        icon={<FlagIcon />}
        onClick={() => setOpen(true)}
      />
      <Dialog
        isOpen={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        purpose="form"
        width={520}
        maxHeight="85dvh"
      >
        <Layout
          header={<DialogHeader title="문항 오류 신고" />}
          content={
            <LayoutContent>
              {success ? (
                <div className="report-success" role="status">
                  <svg
                    aria-hidden="true"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12 3 3 5-6" />
                  </svg>
                  <p>{message}</p>
                </div>
              ) : (
                <form
                  id={`report-form-${itemId}`}
                  onSubmit={submit}
                  className="report-form"
                >
                  <ReportKindOptions
                    itemId={itemId}
                    kind={kind}
                    onChange={setKind}
                  />
                  <label htmlFor={`report-description-${itemId}`}>
                    설명 (선택)
                  </label>
                  <textarea
                    id={`report-description-${itemId}`}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <p className="report-counter">
                    {500 - description.length}자 남음
                  </p>
                  <p className="reports-muted">
                    이름·연락처 같은 개인정보는 쓰지 마세요.
                  </p>
                  {message && <p role="alert">{message}</p>}
                </form>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label={success ? "닫기" : "취소"}
                  variant="secondary"
                  onClick={close}
                  isDisabled={busy}
                />
                {!success && (
                  <Button
                    label="보내기"
                    variant="primary"
                    type="submit"
                    form={`report-form-${itemId}`}
                    isDisabled={!kind || busy}
                    isLoading={busy}
                  />
                )}
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
