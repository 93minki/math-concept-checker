import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { VStack } from "@astryxdesign/core/VStack";
import Mascot from "@/components/mascot";
import type { ReactNode } from "react";
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
  embedded?: boolean;
  variant?: "a" | "b";
};
// Units with a state get a colored tag; untouched ones stay plain muted text,
// so "진행 중" and "시작 전" no longer look alike (user 2026-11-13).
const symbols: Record<Progress, string> = {
  conquered: "✓",
  half: "◐",
  retry: "↻",
  in_progress: "⚡",
  not_started: "",
  unavailable: "🔒",
  done_unknown: "✓",
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
export function Summary({ units, grade }: { units: Unit[]; grade: string }) {
  const { total, conquered } = gradeProgress(units, grade);
  return (
    <VStack gap={2}>
      <p>
        {grade} · {total}단원 중 {conquered}개 정복
      </p>
      <ProgressBar
        label={`${grade} 정복 진행`}
        value={conquered}
        max={total}
        isLabelHidden
      />
    </VStack>
  );
}
export default function LearningMap(props: ViewProps) {
  const rows = props.units.map((unit, index) => {
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
      <article
        key={unit.id}
        className={`learning-row${props.search ? "" : ` path-row path-row-${props.variant ?? "a"}`}`}
        data-state={state}
        data-next={(!props.search && unit.id === props.nextId) || undefined}
      >
        {!props.search && (
          <div className="path-node-wrap">
            {(props.variant ?? "a") === "a" &&
              index < props.units.length - 1 && (
                <svg
                  className="path-connector"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1={[30, 48, 66, 48][index % 4]}
                    y1="0"
                    x2={[48, 66, 48, 30][index % 4]}
                    y2="100"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
            {resume ? (
              <a
                className="path-node"
                aria-label={`${unit.number}. ${unit.name}, ${progressLabels[state]}`}
                href={`/diagnoses/${resume}`}
              >
                {symbols[state] || unit.number}
              </a>
            ) : (
              <button
                type="button"
                className="path-node"
                aria-label={`${unit.number}. ${unit.name}, ${progressLabels[state]}`}
                disabled={props.busy || unit.status === "unavailable"}
                onClick={() => props.start(unit)}
              >
                {symbols[state] || unit.number}
              </button>
            )}
          </div>
        )}
        <div
          className={props.search ? "learning-list-details" : "path-details"}
        >
          <VStack gap={1} className="learning-info">
            <h4>
              {unit.number}. {unit.name}
            </h4>
            <p>{unit.publisher} 기준</p>
            {unit.status === "partial" && <p>이 단원은 일부 내용만 진단해요</p>}
          </VStack>
          <p className="learning-state">
            {badges[state] ? (
              <Badge label={progressLabels[state]} variant={badges[state]} />
            ) : (
              <span className="learning-state-plain">
                {progressLabels[state]}
              </span>
            )}
          </p>
          <HStack className="learning-actions">
            <Button
              label={label}
              variant={unit.id === props.nextId ? "primary" : "secondary"}
              size="lg"
              width="100%"
              isDisabled={
                !resume && (props.busy || unit.status === "unavailable")
              }
              {...(resume
                ? { href: `/diagnoses/${resume}` }
                : { onClick: () => props.start(unit) })}
            />
            <HStack className="learning-more">
              {actions.length > 0 && (
                <MoreMenu
                  label={`${unit.name} 더보기`}
                  items={actions}
                  size="lg"
                />
              )}
            </HStack>
          </HStack>
          {!props.search && unit.id === props.nextId && (
            <div className="path-next">
              <span>다음</span>
              {props.variant === "b" && (
                <p>
                  {resume ? "여기서 이어서 풀어요" : "여기서 개념을 확인해요"}
                </p>
              )}
              <Mascot mood="waving" size={64} />
            </div>
          )}
        </div>
        {props.conflictNode(unit)}
      </article>
    );
  });
  if (props.embedded)
    return (
      <>
        <h3>{props.grade}</h3>
        {rows}
      </>
    );
  return (
    <Card>
      <VStack gap={4}>
        <Summary units={props.allUnits} grade={props.grade} />
        <div className={`path-list path-list-${props.variant ?? "a"}`}>
          {rows}
        </div>
      </VStack>
    </Card>
  );
}
