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
afterEach(cleanup);
test.each([
  [{ latest_result: latest("깊이 이해") }, "정복", 3],
  [{ latest_result: latest("기본 이해") }, "기본 이해", 2],
  [{ latest_result: latest("아직 이해 못 함") }, "다시 도전", 1],
  [{ in_progress_diagnosis_id: "active" }, "진행 중", 0],
  [{}, "시작 전", 0],
  [{ latest_result: latest(null) }, "완료", 0],
  [{ status: "unavailable" }, "준비 중", 0],
] as const)("상태 %s의 게이지와 이름을 표시한다", (change, label, count) => {
  const unit = { ...base, ...change };
  const { container } = render(
    <LearningMap
      units={[unit]}
      allUnits={[unit]}
      grade="중1"
      search={false}
      busy={false}
      nextId={1}
      start={vi.fn()}
      conflictNode={() => null}
    />,
  );
  expect(
    container.querySelectorAll(
      ".unit-gauge-bars .conquered, .unit-gauge-bars .half, .unit-gauge-bars .retry",
    ),
  ).toHaveLength(count);
  expect(
    container.querySelector(".unit-gauge-bars")?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(container.querySelector(".unit-state")?.textContent).toBe(label);
  expect(container.querySelectorAll(".unit-row-actions .btn")).toHaveLength(1);
  if (unit.latest_result) {
    fireEvent.click(screen.getByLabelText("단원 더보기"));
    expect(
      within(screen.getByRole("article"))
        .getByRole("link", { name: "결과 보기" })
        .getAttribute("href"),
    ).toBe("/diagnoses/done");
  }
});
test("다음 단원만 채운 동작 버튼을 표시한다", () => {
  const second = { ...base, id: 2, number: 2 };
  const { container } = render(
    <LearningMap
      units={[base, second]}
      allUnits={[base, second]}
      grade="중1"
      search={false}
      busy={false}
      nextId={2}
      start={vi.fn()}
      conflictNode={() => null}
    />,
  );
  expect(
    container.querySelectorAll(".unit-row-actions .btn:not(.btn-secondary)"),
  ).toHaveLength(1);
});

test("단원 행은 길, 이름, 상태, 주 동작 칸을 갖는다", () => {
  const { container } = render(
    <LearningMap
      units={[base]}
      allUnits={[base]}
      grade="중1"
      search={false}
      busy={false}
      nextId={1}
      start={vi.fn()}
      conflictNode={() => null}
    />,
  );
  const row = container.querySelector("article");
  expect(row?.querySelector(".unit-path-marker")).toBeTruthy();
  const body = row?.querySelector(".unit-row-body");
  expect(body?.querySelector(".unit-row-info")).toBeTruthy();
  expect(body?.querySelector(".unit-gauge")).toBeTruthy();
  expect(
    body?.querySelector(".unit-row-actions .unit-main-action"),
  ).toBeTruthy();
  expect(body?.querySelector(".unit-more-slot")).toBeTruthy();
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
  "보조 동작에 따라 더보기 메뉴를 구성한다",
  (change, restart, result) => {
    const unit = { ...base, ...change };
    const { container } = render(
      <LearningMap
        units={[unit]}
        allUnits={[unit]}
        grade="중1"
        search={false}
        busy={false}
        nextId={1}
        start={vi.fn()}
        conflictNode={() => null}
      />,
    );
    expect(container.querySelectorAll(".unit-main-action")).toHaveLength(1);
    expect(container.querySelectorAll(".unit-more-slot")).toHaveLength(1);
    const trigger = screen.queryByLabelText("단원 더보기");
    if (!restart && !result) {
      expect(trigger).toBeNull();
      return;
    }
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    expect(!!screen.queryByRole("button", { name: "새로 시작하기" })).toBe(
      restart,
    );
    expect(!!screen.queryByRole("link", { name: "결과 보기" })).toBe(result);
    fireEvent.keyDown(trigger!, { key: "Escape" });
    expect(container.querySelector("details")?.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  },
);

test("더보기 메뉴는 바깥을 누르면 닫힌다", () => {
  const unit = { ...base, latest_result: latest("깊이 이해") };
  const { container } = render(
    <LearningMap
      units={[unit]}
      allUnits={[unit]}
      grade="중1"
      search={false}
      busy={false}
      nextId={null}
      start={vi.fn()}
      conflictNode={() => null}
    />,
  );
  fireEvent.click(screen.getByLabelText("단원 더보기"));
  expect(container.querySelector("details")?.open).toBe(true);
  fireEvent.pointerDown(document.body);
  expect(container.querySelector("details")?.open).toBe(false);
});
