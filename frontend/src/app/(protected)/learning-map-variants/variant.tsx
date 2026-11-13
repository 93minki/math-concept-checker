"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import "./path.css";

function snapshot(): "a" | "b" {
  return new URLSearchParams(window.location.search).get("__variant") === "b"
    ? "b"
    : "a";
}
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}
function choose(variant: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("__variant", variant);
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function usePathVariant(): "a" | "b" {
  return useSyncExternalStore<"a" | "b">(subscribe, snapshot, () => "a");
}
export function VariantPicker({ variant }: { variant: "a" | "b" }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === "h") setHidden((value) => !value);
      if (
        !hidden &&
        (!target ||
          target === document.body ||
          target.closest(".path-variant-picker")) &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight")
      ) {
        event.preventDefault();
        choose(event.key === "ArrowLeft" ? "a" : "b");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden]);
  if (hidden) return null;
  return (
    <aside className="path-variant-picker" aria-label="학습 지도 시안 선택">
      <strong>학습 지도 시안</strong>
      <button
        type="button"
        aria-pressed={variant === "a"}
        onClick={() => choose("a")}
      >
        A 지그재그 길
      </button>
      <button
        type="button"
        aria-pressed={variant === "b"}
        onClick={() => choose("b")}
      >
        B 세로 단계 길
      </button>
      <small>← → 전환 · H 숨기기</small>
    </aside>
  );
}
