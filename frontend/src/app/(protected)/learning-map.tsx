import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { Unit } from "@/lib/diagnosis-api";
import {
  gradeProgress,
  progressLabels,
  unitProgress,
  type Progress,
} from "@/lib/unit-progress";
export type ViewProps = {
  units: Unit[];
  allUnits: Unit[];
  grade: string;
  search: boolean;
  busy: boolean;
  nextId: number | null;
  start: (unit: Unit) => void;
  conflictNode: (unit: Unit) => ReactNode;
  // Search results: rows only under a grade subheading, inside the
  // caller's single results card (no per-grade summary).
  embedded?: boolean;
};
export function Summary({ units, grade }: { units: Unit[]; grade: string }) {
  const { total, conquered } = gradeProgress(units, grade);
  return (
    <div className="unit-summary">
      <p>
        {grade} · {total}단원 중 {conquered}개 정복
      </p>
      <div
        role="progressbar"
        aria-label={`${grade} 정복 진행`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={conquered}
        className="unit-progress-track"
      >
        <div style={{ width: `${total ? (conquered / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
export function StatusIcon({ state }: { state: Progress }) {
  return (
    <svg
      aria-hidden="true"
      className={`progress-icon ${state}`}
      viewBox="0 0 32 32"
      width="32"
      height="32"
    >
      <circle
        cx="16"
        cy="16"
        r="13"
        fill={state === "conquered" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
      />
      {state === "conquered" && (
        <path
          d="m9 16 5 5 9-10"
          fill="none"
          stroke="var(--surface)"
          strokeWidth="2.5"
        />
      )}
      {state === "half" && (
        <path d="M16 3a13 13 0 0 0 0 26Z" fill="currentColor" />
      )}
      {state === "in_progress" && (
        <circle cx="16" cy="16" r="5" fill="currentColor" />
      )}
      {state === "retry" && (
        <path
          d="M22 16a6 6 0 1 1-3-5m0-3v4h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      )}
      {state === "done_unknown" && (
        <path d="M16 8v10m0 4v2" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  );
}
export function Details({ unit }: { unit: Unit }) {
  return (
    <div className="unit-row-info">
      <h4>
        {unit.number}. {unit.name}
      </h4>
      <p className="unit-meta">{unit.publisher} 기준</p>
      {unit.status === "partial" && <p>이 단원은 일부 내용만 진단해요</p>}
    </div>
  );
}
function MoreActions({
  unit,
  busy,
  start,
}: {
  unit: Unit;
  busy: boolean;
  start: (unit: Unit) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      const details = detailsRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      )
        details.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <details
      className="unit-more"
      ref={detailsRef}
      onKeyDown={(event) => {
        if (event.key === "Escape" && detailsRef.current?.open) {
          event.preventDefault();
          detailsRef.current.open = false;
          detailsRef.current.querySelector<HTMLElement>("summary")?.focus();
        }
      }}
    >
      <summary aria-label={`${unit.name} 더보기`}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
        >
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </summary>
      <div className="unit-more-menu">
        {unit.in_progress_diagnosis_id && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (detailsRef.current) detailsRef.current.open = false;
              start(unit);
            }}
          >
            새로 시작하기
          </button>
        )}
        {unit.latest_result && (
          <Link
            href={`/diagnoses/${unit.latest_result.diagnosis_id}`}
            onClick={() => {
              if (detailsRef.current) detailsRef.current.open = false;
            }}
          >
            결과 보기
          </Link>
        )}
      </div>
    </details>
  );
}
export function Actions({
  unit,
  busy,
  nextId,
  start,
}: Pick<ViewProps, "busy" | "nextId" | "start"> & { unit: Unit }) {
  const resume = unit.in_progress_diagnosis_id;
  const primary = unit.id === nextId;
  return (
    <div className="unit-row-actions">
      {resume ? (
        <Link
          className={`btn unit-main-action ${primary ? "" : "btn-secondary"}`}
          href={`/diagnoses/${resume}`}
        >
          이어서 풀기
        </Link>
      ) : unit.status === "unavailable" && !unit.latest_result ? (
        <button className="btn btn-secondary unit-main-action" disabled>
          준비 중
        </button>
      ) : (
        <button
          className={`btn unit-main-action ${primary ? "" : "btn-secondary"}`}
          disabled={busy || unit.status === "unavailable"}
          onClick={() => start(unit)}
        >
          {unit.latest_result ? "다시 진단하기" : "진단 시작하기"}
        </button>
      )}
      <div className="unit-more-slot">
        {resume || unit.latest_result ? (
          <MoreActions unit={unit} busy={busy} start={start} />
        ) : null}
      </div>
    </div>
  );
}

export default function LearningMap(props: ViewProps) {
  const rows = props.units.map((unit) => {
    const state = unitProgress(unit);
    const filled =
      state === "conquered"
        ? 3
        : state === "half"
          ? 2
          : state === "retry"
            ? 1
            : 0;
    return (
      <article key={unit.id} className={`unit-path-row ${state}`}>
        <div className="unit-path-marker">
          <StatusIcon state={state} />
        </div>
        <div className="unit-row-body">
          <Details unit={unit} />
          <div className="unit-gauge">
            <div aria-hidden="true" className="unit-gauge-bars">
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= filled ? state : ""} />
              ))}
            </div>
            <span className={`unit-state ${state}`}>
              {progressLabels[state]}
            </span>
          </div>
          <Actions {...props} unit={unit} />
          {props.conflictNode(unit)}
        </div>
      </article>
    );
  });
  if (props.embedded)
    return (
      <>
        <h3 className="unit-map-group">{props.grade}</h3>
        {rows}
      </>
    );
  return (
    <section className="unit-map">
      <Summary units={props.allUnits} grade={props.grade} />
      {rows}
    </section>
  );
}
