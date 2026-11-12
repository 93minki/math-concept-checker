import { expect, test } from "vitest";
import type { Unit } from "./diagnosis-api";
import { gradeProgress, progressLabels, unitProgress } from "./unit-progress";
const base: Unit = {
  id: 1,
  grade: "중1",
  number: 1,
  name: "단원",
  publisher: "출판",
  aliases: [],
  status: "full",
  in_progress_diagnosis_id: null,
  latest_result: null,
};
const result = (stage: string | null) => ({
  diagnosis_id: "id",
  unit_stage: stage,
  completed_at: "2026-01-01",
});
test.each([
  [{}, "not_started", "시작 전"],
  [{ status: "unavailable" }, "unavailable", "준비 중"],
  [{ latest_result: result("깊이 이해") }, "conquered", "정복"],
  [{ latest_result: result("기본 이해") }, "half", "기본 이해"],
  [{ latest_result: result("아직 이해 못 함") }, "retry", "다시 도전"],
  [{ latest_result: result(null) }, "done_unknown", "완료"],
  [
    { latest_result: result("깊이 이해"), in_progress_diagnosis_id: "old" },
    "in_progress",
    "진행 중",
  ],
] as const)("단원 상태 %o", (changes, state, label) => {
  expect(unitProgress({ ...base, ...changes })).toBe(state);
  expect(progressLabels[state]).toBe(label);
});
test("학년별 정복 수는 해당 학년의 깊이 이해만 센다", () => {
  expect(
    gradeProgress(
      [
        { ...base, latest_result: result("깊이 이해") },
        { ...base, id: 2 },
        { ...base, id: 3, grade: "중2", latest_result: result("깊이 이해") },
      ],
      "중1",
    ),
  ).toEqual({ total: 2, conquered: 1 });
});

test("깊이 이해를 정복한 뒤 다시 푸는 단원도 정복 수에 포함한다", () => {
  expect(
    gradeProgress(
      [
        {
          ...base,
          latest_result: result("깊이 이해"),
          in_progress_diagnosis_id: "current",
        },
      ],
      "중1",
    ),
  ).toEqual({ total: 1, conquered: 1 });
});
