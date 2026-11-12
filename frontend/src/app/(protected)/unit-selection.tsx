"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LearningMap from "./learning-map";
import { unitProgress } from "@/lib/unit-progress";
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
  const nextUnit =
    displayed.find((unit) => unitProgress(unit) === "in_progress") ??
    displayed
      .filter(
        (unit) =>
          ["not_started", "retry"].includes(unitProgress(unit)) &&
          unit.status !== "unavailable",
      )
      .sort((a, b) => a.number - b.number)[0];
  return (
    <section className="stack unit-selection">
      <h2>진단할 단원을 골라요</h2>
      <label htmlFor="unit-search">단원 검색</label>
      <input
        id="unit-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="단원 이름을 입력해요"
      />
      {error && <p role="alert">{error}</p>}
      {!units && !error && <p>단원을 불러오고 있어요.</p>}
      {filtered?.length === 0 && <p>검색 결과가 없어요.</p>}
      <div className="grade-tabs" role="tablist" aria-label="학년 선택">
        {["중1", "중2", "중3"].map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={grade === item}
            onClick={() => setGrade(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <>
        {(["중1", "중2", "중3"] as const).map((item) => {
          if (!query.trim() && item !== grade) return null;
          const group = displayed.filter((unit) => unit.grade === item);
          if (!group.length) return null;
          return (
            <div key={item}>
              {query.trim() && <h3>{item}</h3>}
              <LearningMap
                units={group}
                allUnits={units ?? []}
                grade={item}
                search={!!query.trim()}
                busy={busy}
                nextId={nextUnit?.id ?? null}
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
                      <Link
                        className="btn btn-secondary"
                        href={`/diagnoses/${conflict.id}`}
                      >
                        이어서 풀기
                      </Link>
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => void start(conflict.unit, true)}
                      >
                        새로 시작하기
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setConflict(null)}
                      >
                        취소
                      </button>
                    </div>
                  )
                }
              />
            </div>
          );
        })}
      </>
    </section>
  );
}
