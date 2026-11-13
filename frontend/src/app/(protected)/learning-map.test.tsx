import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { Unit } from "@/lib/diagnosis-api";
import LearningMap from "./learning-map";
const base: Unit = {
  id: 1,
  grade: "중1",
  number: 1,
  name: "단원",
  publisher: "동아출판",
  aliases: [],
  status: "full",
  in_progress_diagnosis_id: null,
  latest_result: null,
};
const latest = (stage: string | null) => ({
  diagnosis_id: "done",
  unit_stage: stage,
  completed_at: "2026-01-01",
});
function view(units: Unit[], nextId: number | null = 1, start = vi.fn()) {
  return render(
    <LearningMap
      units={units}
      allUnits={units}
      grade="중1"
      search={false}
      busy={false}
      nextId={nextId}
      start={start}
      conflictNode={() => null}
    />,
  );
}
afterEach(cleanup);
test.each([
  [{ latest_result: latest("깊이 이해") }, "정복", "tag"],
  [{ latest_result: latest("기본 이해") }, "기본 이해", "tag"],
  [{ latest_result: latest("아직 이해 못 함") }, "다시 도전", "tag"],
  [{ in_progress_diagnosis_id: "active" }, "진행 중", "tag"],
  [{}, "시작 전", "plain"],
  [{ latest_result: latest(null) }, "완료", "tag"],
  [{ status: "unavailable" }, "준비 중", "plain"],
] as const)(
  "단원 상태는 꼬리표나 흐린 글자로 나타난다",
  (change, label, shape) => {
    // Units with a state get a tag, untouched ones plain muted text, so
    // "진행 중" and "시작 전" differ by shape, not only color (2026-11-13).
    const unit = { ...base, ...change };
    view([unit]);
    const row = screen.getByRole("article");
    const state = row.querySelector(".learning-state");
    expect(state?.textContent).toContain(label);
    expect(!!state?.querySelector(".learning-state-plain")).toBe(
      shape === "plain",
    );
    expect(within(row).getByRole("heading", { name: "1. 단원" })).toBeTruthy();
    expect(row.querySelector(".learning-actions .astryx-button")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "중1 정복 진행" })
        .getAttribute("aria-valuenow"),
    ).toBe(unit.latest_result?.unit_stage === "깊이 이해" ? "1" : "0");
  },
);
test("다음 단원만 주 버튼으로 표시한다", () => {
  view([base, { ...base, id: 2, number: 2 }], 2);
  const buttons = screen.getAllByRole("button", { name: "진단 시작하기" });
  expect(buttons.map((button) => button.getAttribute("data-variant"))).toEqual([
    "secondary",
    "primary",
  ]);
});
test.each([
  [
    { in_progress_diagnosis_id: "active", latest_result: latest("깊이 이해") },
    true,
    true,
  ],
  [{ in_progress_diagnosis_id: "active" }, true, false],
  [{ latest_result: latest("기본 이해") }, false, true],
  [{}, false, false],
] as const)(
  "더보기 메뉴는 가능한 동작만 제공한다",
  (change, restart, result) => {
    const start = vi.fn();
    view([{ ...base, ...change }], 1, start);
    const trigger = screen.queryByRole("button", { name: "단원 더보기" });
    if (!restart && !result) {
      expect(trigger).toBeNull();
      return;
    }
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    expect(!!screen.queryByRole("menuitem", { name: "새로 시작하기" })).toBe(
      restart,
    );
    expect(!!screen.queryByRole("menuitem", { name: "결과 보기" })).toBe(
      result,
    );
    if (result)
      expect(
        screen
          .getByRole("menuitem", { name: "결과 보기" })
          .getAttribute("href"),
      ).toBe("/diagnoses/done");
    if (restart) {
      fireEvent.click(screen.getByRole("menuitem", { name: "새로 시작하기" }));
      expect(start).toHaveBeenCalledTimes(1);
    }
  },
);

test("더보기 메뉴는 Escape로 닫힌다", () => {
  view([{ ...base, latest_result: latest("깊이 이해") }]);
  const trigger = screen.getByRole("button", { name: "단원 더보기" });
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});
