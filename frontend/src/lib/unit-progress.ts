import type { Unit } from "./diagnosis-api";
export type Progress =
  | "conquered"
  | "half"
  | "retry"
  | "in_progress"
  | "not_started"
  | "unavailable"
  | "done_unknown";
export function unitProgress(unit: Unit): Progress {
  if (unit.in_progress_diagnosis_id) return "in_progress";
  if (unit.latest_result) {
    if (unit.latest_result.unit_stage === "깊이 이해") return "conquered";
    if (unit.latest_result.unit_stage === "기본 이해") return "half";
    if (unit.latest_result.unit_stage === "아직 이해 못 함") return "retry";
    return "done_unknown";
  }
  return unit.status === "unavailable" ? "unavailable" : "not_started";
}
export const progressLabels: Record<Progress, string> = {
  conquered: "정복",
  half: "기본 이해",
  retry: "다시 도전",
  in_progress: "진행 중",
  not_started: "시작 전",
  unavailable: "준비 중",
  done_unknown: "완료",
};
export function gradeProgress(units: Unit[], grade: string) {
  const group = units.filter((unit) => unit.grade === grade);
  return {
    total: group.length,
    conquered: group.filter(
      (unit) => unit.latest_result?.unit_stage === "깊이 이해",
    ).length,
  };
}
