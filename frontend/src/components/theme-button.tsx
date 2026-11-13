"use client";
import { useSyncExternalStore } from "react";
import { IconButton } from "@astryxdesign/core/IconButton";

// The stored choice is the source of truth: Astryx's root <Theme> owns
// <html data-theme> and clears it while the mode is "system".
export function storedTheme(): "light" | "dark" | null {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}
function currentTheme(): "light" | "dark" {
  const chosen = storedTheme() ?? document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
export function subscribeTheme(notify: () => void) {
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "theme" && event.key !== null) return;
    if (event.newValue === "light" || event.newValue === "dark")
      document.documentElement.dataset.theme = event.newValue;
    else delete document.documentElement.dataset.theme;
    notify();
  };
  media?.addEventListener("change", notify);
  window.addEventListener("theme-change", notify);
  window.addEventListener("storage", onStorage);
  return () => {
    media?.removeEventListener("change", notify);
    window.removeEventListener("theme-change", notify);
    window.removeEventListener("storage", onStorage);
  };
}
export default function ThemeButton() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    currentTheme,
    () => "unknown",
  );
  const label =
    theme === "unknown"
      ? "테마 바꾸기"
      : theme === "dark"
        ? "라이트 모드로 바꾸기"
        : "다크 모드로 바꾸기";
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* Keep the current screen choice. */
    }
    window.dispatchEvent(new Event("theme-change"));
  }
  return (
    <IconButton
      label={label}
      variant="ghost"
      size="lg"
      onClick={toggle}
      icon={
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {theme === "dark" ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
            </>
          ) : (
            <path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" />
          )}
        </svg>
      }
    />
  );
}
