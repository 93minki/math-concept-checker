import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { VStack } from "@astryxdesign/core/VStack";
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
};
// Units with a state get a colored tag; untouched ones stay plain muted text,
// so "진행 중" and "시작 전" no longer look alike (user 2026-11-13).
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
  const rows = props.units.map((unit) => {
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
      <article key={unit.id} className="learning-row">
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
        {rows}
      </VStack>
    </Card>
  );
}
