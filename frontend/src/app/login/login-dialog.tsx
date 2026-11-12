"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import LoginForm from "./login-form";

export default function LoginDialog() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.open && !dialog.matches(":modal")) {
      dialog.close();
      dialog.showModal();
    }
    dialog.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
  }, []);

  function close() {
    if (closing.current) return;
    closing.current = true;
    if (dialogRef.current?.open) dialogRef.current.close();
    router.replace("/login", { scroll: false });
    document
      .querySelector<HTMLElement>("[data-login-trigger]")
      ?.focus({ preventScroll: true });
  }

  return (
    <dialog
      ref={dialogRef}
      open
      className="login-dialog"
      aria-labelledby="login-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (!dialogRef.current?.open) close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          close();
      }}
    >
      <button
        className="login-dialog-close"
        type="button"
        aria-label="닫기"
        onClick={close}
      >
        닫기
      </button>
      <LoginForm />
    </dialog>
  );
}
