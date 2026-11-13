"use client";

import StatusScreen from "@/components/status-screen";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
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
    <VStack gap={4} className="history-view">
      <Button label="← 단원 선택으로" href="/" variant="ghost" size="lg" />
      <h1>지난 기록</h1>
      {items?.length === 0 && (
        <StatusScreen
          mood="waving"
          title="아직 진단 기록이 없어요"
          description="단원을 골라 첫 진단을 시작해 보세요."
          actions={<Button label="단원 고르기" href="/" variant="primary" />}
        />
      )}
      {items && items.length > 0 && (
        <List hasDividers>
          {items.map((item) => (
            <ListItem
              key={item.id}
              href={
                item.status === "aborted" && item.stage1_submitted_at === null
                  ? undefined
                  : `/diagnoses/${encodeURIComponent(item.id)}`
              }
              isDisabled={
                item.status === "aborted" && item.stage1_submitted_at === null
              }
              label={
                <Text
                  color={
                    item.status === "aborted" &&
                    item.stage1_submitted_at === null
                      ? "secondary"
                      : "primary"
                  }
                >
                  {item.unit.grade} · {item.unit.name}
                </Text>
              }
              description={
                <VStack gap={1}>
                  <span>{item.unit.publisher} 기준</span>
                  <time dateTime={item.started_at}>
                    시작: {dateFormat.format(new Date(item.started_at))}
                  </time>
                  {item.completed_at && (
                    <time dateTime={item.completed_at}>
                      완료: {dateFormat.format(new Date(item.completed_at))}
                    </time>
                  )}
                  {item.aborted_at && (
                    <time dateTime={item.aborted_at}>
                      중단: {dateFormat.format(new Date(item.aborted_at))}
                    </time>
                  )}
                  {(item.status === "stage1" || item.status === "stage2") && (
                    <span>이어서 풀기</span>
                  )}
                </VStack>
              }
              endContent={
                <Badge
                  label={statusText(item)}
                  variant={
                    item.status === "completed"
                      ? "success"
                      : item.status === "aborted"
                        ? "warning"
                        : "info"
                  }
                />
              }
            />
          ))}
        </List>
      )}
      {loading && (
        <StatusScreen
          mood="thinking"
          title="지난 기록을 불러오고 있어요."
          live
          compact
        />
      )}
      {error && (
        <Banner
          role="alert"
          status="error"
          title="지난 기록을 불러오지 못했어요."
          endContent={
            <Button
              label="다시 시도"
              size="lg"
              isDisabled={loading}
              onClick={() =>
                void loadMore(items === null ? undefined : (next ?? undefined))
              }
            />
          }
        />
      )}
      {next && !error && (
        <Button
          label="더 보기"
          variant="secondary"
          size="lg"
          isDisabled={loading}
          onClick={() => void loadMore(next)}
        />
      )}
    </VStack>
  );
}
