import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Unit } from "@/lib/diagnosis-api";
import {
  gradeProgress,
  progressLabels,
  unitProgress,
  type Progress,
} from "@/lib/unit-progress";
import "./learning-map.css";

export type ViewProps = {
  units: Unit[];
  allUnits: Unit[];
  grade: string;
  search: boolean;
  busy: boolean;
  start: (unit: Unit) => void;
  conflictNode: (unit: Unit) => ReactNode;
  embedded?: boolean;
};
const badges: Partial<
  Record<Progress, "success" | "warning" | "error" | "info" | "neutral">
> = {
  conquered: "success",
  half: "warning",
  retry: "error",
  in_progress: "info",
  done_unknown: "neutral",
};
function StateIcon({ state }: { state: Progress }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(state === "conquered" || state === "done_unknown") && (
        <path d="m5 12 4 4L19 6" />
      )}
      {state === "in_progress" && (
        <path d="M8 5v14l11-7z" fill="currentColor" />
      )}
      {state === "half" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </>
      )}
      {state === "retry" && (
        <>
          <path d="M20 11a8 8 0 1 0-2 6" />
          <path d="M20 4v7h-7" />
        </>
      )}
    </svg>
  );
}
export function Summary({ units, grade }: { units: Unit[]; grade: string }) {
  const { total, conquered } = gradeProgress(units, grade);
  return (
    <VStack gap={2}>
      <p>
        {grade} · {total}단원 중 {conquered}개 정복
      </p>
      <div className="summary-progress">
        <ProgressBar
          label={`${grade} 정복 진행`}
          value={conquered}
          max={total}
          isLabelHidden
        />
        <span>
          {conquered} / {total}
        </span>
      </div>
    </VStack>
  );
}
function Details({
  unit,
  props,
  headingRef,
}: {
  unit: Unit;
  props: ViewProps;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
}) {
  const state = unitProgress(unit);
  const resume = unit.in_progress_diagnosis_id;
  const actions = [
    ...(resume
      ? [
          {
            label: "새로 시작하기",
            onClick: () => props.start(unit),
            isDisabled: props.busy,
          },
        ]
      : []),
    ...(unit.latest_result
      ? [
          {
            label: "결과 보기",
            href: `/diagnoses/${unit.latest_result.diagnosis_id}`,
          },
        ]
      : []),
  ];
  const label = resume
    ? "이어서 풀기"
    : unit.status === "unavailable" && !unit.latest_result
      ? "준비 중"
      : unit.latest_result
        ? "다시 진단하기"
        : "진단 시작하기";
  return (
    <>
      {!props.search && (
        <span className="concept-icon" aria-hidden="true">
          <svg
            viewBox="0 0 40 40"
            width="40"
            height="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M5 10h10M10 5v10M25 10h10M5 29h10M10 24h.01M10 34h.01M26 25l8 8m0-8-8 8" />
          </svg>
        </span>
      )}
      <VStack gap={1} className="learning-info">
        {props.search ? (
          <h4>
            {unit.number}. {unit.name}
          </h4>
        ) : (
          <h3 tabIndex={-1} ref={headingRef}>
            {unit.number}. {unit.name}
          </h3>
        )}
        <p>{unit.publisher} 기준</p>
        {unit.status === "partial" && <p>이 단원은 일부 내용만 진단해요</p>}
      </VStack>
      <p className="learning-state">
        {badges[state] ? (
          <Badge label={progressLabels[state]} variant={badges[state]} />
        ) : (
          <span className="learning-state-plain">{progressLabels[state]}</span>
        )}
      </p>
      {!props.search && (
        <div className="concept-section">
          <h4>주요 개념</h4>
          <div className="concept-chips">
            {unit.concepts.map((concept, index) => (
              <span key={`${index}-${concept}`}>{concept}</span>
            ))}
          </div>
        </div>
      )}
      <HStack className="learning-actions">
        <Button
          label={label}
          icon={!props.search ? <StateIcon state="in_progress" /> : undefined}
          variant="primary"
          size="lg"
          width="100%"
          isDisabled={!resume && (props.busy || unit.status === "unavailable")}
          {...(resume
            ? { href: `/diagnoses/${resume}` }
            : { onClick: () => props.start(unit) })}
        />
        <HStack className="learning-more">
          {actions.length > 0 && (
            <MoreMenu label={`${unit.name} 더보기`} items={actions} size="lg" />
          )}
        </HStack>
      </HStack>
      {props.conflictNode(unit)}
    </>
  );
}
export default function LearningMap(props: ViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const nodeRefs = useRef(new Map<number, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = props.units.find((unit) => unit.id === selectedId);
  useEffect(() => {
    if (
      selectedId !== null &&
      window.matchMedia?.("(max-width: 899px)").matches
    )
      headingRef.current?.focus();
  }, [selectedId]);
  useEffect(() => {
    const panel = panelRef.current;
    const list = listRef.current;
    if (!panel || !list || !selected || typeof ResizeObserver === "undefined")
      return;
    const update = () =>
      list.style.setProperty(
        "--sheet-height",
        `${panel.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    update();
    return () => {
      observer.disconnect();
      list.style.removeProperty("--sheet-height");
    };
  }, [selected]);
  function close() {
    const id = selectedId;
    setSelectedId(null);
    if (id !== null) nodeRefs.current.get(id)?.focus();
  }
  if (props.search)
    return (
      <>
        <h3>{props.grade}</h3>
        {props.units.map((unit) => (
          <article
            key={unit.id}
            className="learning-row"
            data-state={unitProgress(unit)}
          >
            <div className="learning-list-details">
              <Details unit={unit} props={props} />
            </div>
          </article>
        ))}
      </>
    );
  return (
    <VStack gap={4}>
      <Card>
        <div className="path-summary">
          <Summary units={props.allUnits} grade={props.grade} />
        </div>
      </Card>
      <div
        className="path-layout"
        onKeyDown={(event) => {
          // An open menu (MoreMenu uses the native popover, which handles
          // Escape without preventDefault) gets Escape first.
          const menuOpen =
            panelRef.current?.querySelector('[aria-expanded="true"]') ??
            (event.target instanceof Element &&
              event.target.closest('[role="menu"]'));
          if (
            event.key === "Escape" &&
            !event.defaultPrevented &&
            !menuOpen &&
            selected
          ) {
            event.stopPropagation();
            close();
          }
        }}
      >
        <div className="path-card">
          <div
            className={`path-list${selected ? " has-selection" : ""}`}
            ref={listRef}
          >
            {props.units.map((unit, index) => {
              const state = unitProgress(unit);
              return (
                <article
                  key={unit.id}
                  className="learning-row path-row"
                  data-state={state}
                >
                  <div className="path-node-wrap">
                    {index < props.units.length - 1 && (
                      <svg
                        className={`path-connector${unit.latest_result && props.units[index + 1].latest_result ? " is-complete" : ""}`}
                        aria-hidden="true"
                        viewBox="0 0 96 112"
                      >
                        <path
                          className="connector-desktop"
                          d={`M0 0 C 0 56 ${index % 2 === 0 ? 48 : -48} 56 ${index % 2 === 0 ? 48 : -48} 112`}
                        />
                        <path
                          className="connector-mobile"
                          d={`M0 0 C 0 56 ${index % 2 === 0 ? 28 : -28} 56 ${index % 2 === 0 ? 28 : -28} 112`}
                        />
                      </svg>
                    )}
                    <button
                      ref={(node) => {
                        if (node) nodeRefs.current.set(unit.id, node);
                        else nodeRefs.current.delete(unit.id);
                      }}
                      type="button"
                      className="path-node"
                      data-state={state}
                      aria-label={`${unit.number}. ${unit.name}, ${progressLabels[state]}`}
                      aria-current={selectedId === unit.id ? "true" : undefined}
                      aria-controls="unit-details"
                      onClick={() => setSelectedId(unit.id)}
                    >
                      {state === "not_started" || state === "unavailable" ? (
                        unit.number
                      ) : (
                        <StateIcon state={state} />
                      )}
                      <span className="path-name" aria-hidden="true">
                        {unit.number}. {unit.name}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="path-legend" aria-label="학습 상태 범례">
            {(
              [
                "conquered",
                "in_progress",
                "half",
                "retry",
                "not_started",
              ] as const
            ).map((state) => (
              <span key={state}>
                <i className={`legend-node legend-${state}`}>
                  {state === "not_started" ? "1" : <StateIcon state={state} />}
                </i>
                {progressLabels[state]}
              </span>
            ))}
          </div>
        </div>
        <section
          id="unit-details"
          aria-label="단원 내용"
          ref={panelRef}
          className={`path-panel${selected ? " is-open" : ""}`}
        >
          {selected ? (
            <>
              <button
                type="button"
                className="path-close"
                aria-label="닫기"
                onClick={close}
              >
                ×
              </button>
              <Details unit={selected} props={props} headingRef={headingRef} />
            </>
          ) : (
            <p className="path-placeholder">
              단원을 누르면 내용이 여기에 보여요
            </p>
          )}
        </section>
      </div>
    </VStack>
  );
}
