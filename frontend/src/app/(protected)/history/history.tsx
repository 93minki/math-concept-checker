"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  authRedirect,
  getHistory,
  type HistoryItem,
} from "@/lib/diagnosis-api";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function statusText(item: HistoryItem) {
  if (item.status === "completed") return "완료";
  if (item.status === "aborted") {
    return item.abort_reason === "expired"
      ? "중단 (기간 만료)"
      : "중단 (새로 시작)";
  }
  return "진행 중";
}

export default function History() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getHistory()
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setNext(page.next_before);
      })
      .catch((e) => {
        if (active && !authRedirect(e, router.push)) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function loadMore(before?: string) {
    setLoading(true);
    setError(false);
    try {
      const page = await getHistory(20, before);
      setItems((current) =>
        before === undefined ? page.items : [...(current ?? []), ...page.items],
      );
      setNext(page.next_before);
    } catch (e) {
      if (!authRedirect(e, router.push)) setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <Link className="study-link" href="/">
        ← 단원 선택으로
      </Link>
      <h1>지난 기록</h1>
      {items?.length === 0 && <p>아직 진단 기록이 없어요</p>}
      {items?.map((item) => (
        <Link
          className="unit-card stack"
          href={`/diagnoses/${encodeURIComponent(item.id)}`}
          key={item.id}
        >
          <strong>
            {item.unit.grade} · {item.unit.name}
          </strong>
          <span>{item.unit.publisher} 기준</span>
          <time dateTime={item.started_at}>
            {dateFormat.format(new Date(item.started_at))}
          </time>
          <span>{statusText(item)}</span>
          {(item.status === "stage1" || item.status === "stage2") && (
            <span>이어서 풀기</span>
          )}
        </Link>
      ))}
      {loading && <p role="status">지난 기록을 불러오고 있어요.</p>}
      {error && (
        <div role="alert">
          <p>지난 기록을 불러오지 못했어요.</p>
          <button
            className="btn"
            disabled={loading}
            onClick={() =>
              void loadMore(items === null ? undefined : (next ?? undefined))
            }
          >
            다시 시도
          </button>
        </div>
      )}
      {next && !error && (
        <button
          className="btn btn-secondary"
          disabled={loading}
          onClick={() => void loadMore(next)}
        >
          더 보기
        </button>
      )}
    </div>
  );
}
