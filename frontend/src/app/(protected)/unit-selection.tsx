"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      {(["중1", "중2", "중3"] as const).map((item) => {
        if (!query.trim() && item !== grade) return null;
        const group = filtered?.filter((unit) => unit.grade === item) ?? [];
        return (
          group.length > 0 && (
            <section key={item} className="stack">
              {query.trim() && <h3>{item}</h3>}
              <div className="unit-grid">
                {group.map((unit) => (
                  <article
                    className={`unit-card stack${unit.in_progress_diagnosis_id ? " in-progress" : ""}`}
                    key={unit.id}
                  >
                    {query.trim() && (
                      <span className={`grade-chip grade-${item.slice(-1)}`}>
                        {item}
                      </span>
                    )}
                    <h4>
                      {unit.number}. {unit.name}
                    </h4>
                    <p className="unit-meta">{unit.publisher} 기준</p>
                    {unit.status === "partial" && (
                      <p className="badge">이 단원은 일부 내용만 진단해요</p>
                    )}
                    {unit.in_progress_diagnosis_id && (
                      <p className="badge badge-warn">진행 중</p>
                    )}
                    <div className="unit-actions">
                      {unit.status === "unavailable" ? (
                        <button className="btn" disabled>
                          준비 중
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          disabled={busy}
                          onClick={() => void start(unit)}
                        >
                          진단 시작하기
                        </button>
                      )}
                      {unit.in_progress_diagnosis_id && (
                        <Link
                          className="btn unit-resume"
                          href={`/diagnoses/${unit.in_progress_diagnosis_id}`}
                        >
                          이어서 풀기
                        </Link>
                      )}
                    </div>
                    {conflict && conflict.unit.id === unit.id && (
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
                          className="btn"
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
                    )}
                  </article>
                ))}
              </div>
            </section>
          )
        );
      })}
    </section>
  );
}
