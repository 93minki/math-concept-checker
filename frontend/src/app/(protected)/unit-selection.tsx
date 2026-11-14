"use client";
import StatusScreen from "@/components/status-screen";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { VStack } from "@astryxdesign/core/VStack";
import { useRouter } from "next/navigation";
import LearningMap from "./learning-map";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  authRedirect,
  getUnits,
  startDiagnosis,
  type Unit,
} from "@/lib/diagnosis-api";

export default function UnitSelection() {
  const router = useRouter();
  const [grade, setGrade] = useState("중1");
  const conflictRef = useRef<HTMLDivElement>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ unit: Unit; id: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    getUnits()
      .then((data) => {
        if (active) setUnits(data);
      })
      .catch((e) => {
        if (active && !authRedirect(e, router.push))
          setError("단원을 불러오지 못했어요. 새로고침해 주세요.");
      });
    return () => {
      active = false;
    };
  }, [router]);
  useEffect(() => {
    const node = conflictRef.current;
    if (!node) return;
    node.focus();
    if (typeof node.scrollIntoView === "function")
      node.scrollIntoView({ block: "nearest" });
  }, [conflict]);
  async function start(unit: Unit, restart = false) {
    setBusy(true);
    setError("");
    try {
      const result = await startDiagnosis(unit.id, restart);
      router.push(`/diagnoses/${result.diagnosis_id}`);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.detail &&
        typeof e.detail === "object" &&
        "code" in e.detail &&
        e.detail.code === "in_progress" &&
        "diagnosis_id" in e.detail &&
        typeof e.detail.diagnosis_id === "string"
      )
        setConflict({ unit, id: e.detail.diagnosis_id });
      else if (!authRedirect(e, router.push))
        setError("진단을 시작하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  const filtered = units?.filter((unit) =>
    [unit.name, ...unit.aliases].some((name) =>
      name.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );
  const displayed =
    filtered?.filter((unit) => query.trim() || unit.grade === grade) ?? [];
  return (
    <section className="stack unit-selection">
      <h2>진단할 단원을 골라요</h2>
      <TextInput
        label="단원 검색"
        value={query}
        onChange={setQuery}
        placeholder="단원 이름을 입력해요"
        width="100%"
        size="lg"
      />
      {error && <p role="alert">{error}</p>}
      {filtered?.length === 0 && <p>검색 결과가 없어요.</p>}
      <TabList
        value={query.trim() ? "" : grade}
        onChange={setGrade}
        role="tablist"
        aria-label="학년 선택"
        size="lg"
      >
        {["중1", "중2", "중3"].map((item) => (
          <Tab key={item} value={item} label={item} />
        ))}
      </TabList>
      {!units && !error && (
        <StatusScreen
          mood="waiting"
          title="단원을 불러오고 있어요."
          live
          compact
        />
      )}
      <SearchFrame searching={!!query.trim()} count={displayed.length}>
        {(["중1", "중2", "중3"] as const).map((item) => {
          if (!query.trim() && item !== grade) return null;
          const group = displayed.filter((unit) => unit.grade === item);
          if (!group.length) return null;
          return (
            <VStack key={item} gap={3}>
              <LearningMap
                key={item}
                embedded={!!query.trim()}
                units={group}
                allUnits={units ?? []}
                grade={item}
                search={!!query.trim()}
                busy={busy}
                start={(unit) => void start(unit)}
                conflictNode={(unit) =>
                  conflict?.unit.id === unit.id && (
                    <div
                      ref={conflictRef}
                      tabIndex={-1}
                      className="unit-conflict stack"
                      role="dialog"
                      aria-label="진행 중인 진단"
                    >
                      <p>
                        진행 중인 진단이 있어요. 이어서 풀거나 새로 시작할 수
                        있어요.
                      </p>
                      <Button
                        label="이어서 풀기"
                        variant="secondary"
                        size="lg"
                        href={`/diagnoses/${conflict.id}`}
                      />
                      <Button
                        label="새로 시작하기"
                        variant="secondary"
                        size="lg"
                        isDisabled={busy}
                        onClick={() => void start(conflict.unit, true)}
                      />
                      <Button
                        label="취소"
                        variant="secondary"
                        size="lg"
                        onClick={() => setConflict(null)}
                      />
                    </div>
                  )
                }
              />
            </VStack>
          );
        })}
      </SearchFrame>
    </section>
  );
}

// While searching, every grade's matches share one card with a count.
function SearchFrame({
  searching,
  count,
  children,
}: {
  searching: boolean;
  count: number;
  children: React.ReactNode;
}) {
  if (!searching) return <>{children}</>;
  if (count === 0) return null;
  return (
    <section aria-label="검색 결과">
      <Card>
        <VStack gap={4}>
          <p>검색 결과 {count}개</p>
          {children}
        </VStack>
      </Card>
    </section>
  );
}
