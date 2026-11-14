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
function view(units: Unit[], start = vi.fn()) {
  return render(
    <LearningMap
      units={units}
      allUnits={units}
      grade="중1"
      search={false}
      busy={false}
      start={start}
      conflictNode={() => null}
    />,
  );
}
function open(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  return screen.getByRole("region", { name: "단원 내용" });
}
afterEach(cleanup);
test.each([
  [{ latest_result: latest("깊이 이해") }, "정복", "conquered", "tag"],
  [{ latest_result: latest("기본 이해") }, "기본 이해", "half", "tag"],
  [{ latest_result: latest("아직 이해 못 함") }, "다시 도전", "retry", "tag"],
  [{ in_progress_diagnosis_id: "active" }, "진행 중", "in_progress", "tag"],
  [{}, "시작 전", "not_started", "plain"],
  [{ latest_result: latest(null) }, "완료", "done_unknown", "tag"],
  [{ status: "unavailable" }, "준비 중", "unavailable", "plain"],
] as const)("단원 상태 %s", (change, label, stateName, shape) => {
  const unit = { ...base, ...change };
  view([unit]);
  const node = screen.getByRole("button", { name: `1. 단원, ${label}` });
  expect(node.getAttribute("data-state")).toBe(stateName);
  expect(node.querySelector("svg") !== null).toBe(stateName !== "not_started");
  expect(node.textContent).not.toMatch(/[⚡🔒]/u);
  const panel = open(`1. 단원, ${label}`);
  const state = panel.querySelector(".learning-state");
  expect(state?.textContent).toContain(label);
  expect(!!state?.querySelector(".learning-state-plain")).toBe(
    shape === "plain",
  );
  expect(within(panel).getByRole("heading", { name: "1. 단원" })).toBeTruthy();
  expect(
    panel
      .querySelector(".learning-actions .astryx-button")
      ?.getAttribute("data-variant"),
  ).toBe("primary");
  if (stateName === "unavailable")
    expect(
      within(panel)
        .getByRole("button", { name: "준비 중" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  if (stateName === "in_progress")
    expect(
      within(panel)
        .getByRole("link", { name: "이어서 풀기" })
        .getAttribute("href"),
    ).toBe("/diagnoses/active");
  expect(
    screen
      .getByRole("progressbar", { name: "중1 정복 진행" })
      .getAttribute("aria-valuenow"),
  ).toBe(unit.latest_result?.unit_stage === "깊이 이해" ? "1" : "0");
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
    view([{ ...base, ...change }], start);
    const state = restart ? "진행 중" : result ? "기본 이해" : "시작 전";
    const panel = open(`1. 단원, ${state}`);
    const trigger = within(panel).queryByRole("button", {
      name: "단원 더보기",
    });
    if (!restart && !result) {
      expect(trigger).toBeNull();
      return;
    }
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
  open("1. 단원, 정복");
  const trigger = screen.getByRole("button", { name: "단원 더보기" });
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  // In a browser the native popover handles Escape without preventDefault,
  // so the keydown still bubbles through the panel; while the menu is open
  // it must not close the unit panel (e2e-dev 2026-11-14).
  fireEvent.keyDown(screen.getByRole("heading", { name: "1. 단원" }), {
    key: "Escape",
  });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("heading", { name: "1. 단원" })).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "1. 단원, 정복" })
      .getAttribute("aria-current"),
  ).toBe("true");
});
test("초기 안내와 단원 전환, 선택 표시 및 닫기", () => {
  const { container } = view([base, { ...base, id: 2, number: 2, name: "둘" }]);
  const first = screen.getByRole("button", { name: "1. 단원, 시작 전" });
  const second = screen.getByRole("button", { name: "2. 둘, 시작 전" });
  expect(screen.getByText("단원을 누르면 내용이 여기에 보여요")).toBeTruthy();
  expect(first.hasAttribute("aria-current")).toBe(false);
  expect(container.querySelector(".mascot, .path-next")).toBeNull();
  open("1. 단원, 시작 전");
  expect(first.getAttribute("aria-current")).toBe("true");
  const panel = open("2. 둘, 시작 전");
  expect(first.hasAttribute("aria-current")).toBe(false);
  expect(second.getAttribute("aria-current")).toBe("true");
  expect(within(panel).getByRole("heading", { name: "2. 둘" })).toBeTruthy();
  fireEvent.keyDown(panel, { key: "Escape" });
  expect(second.hasAttribute("aria-current")).toBe(false);
  expect(document.activeElement).toBe(second);
  open("1. 단원, 시작 전");
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(document.activeElement).toBe(first);
});

test("모바일 시트는 제목으로 포커스를 옮기고 닫으면 노드로 돌린다", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  try {
    const start = vi.fn();
    view([base], start);
    const node = screen.getByRole("button", { name: "1. 단원, 시작 전" });
    fireEvent.click(node);
    const panel = screen.getByRole("region", { name: "단원 내용" });
    expect(document.activeElement).toBe(
      within(panel).getByRole("heading", { name: "1. 단원" }),
    );
    fireEvent.click(
      within(panel).getByRole("button", { name: "진단 시작하기" }),
    );
    expect(start).toHaveBeenCalledWith(base);
    fireEvent.click(within(panel).getByRole("button", { name: "닫기" }));
    expect(document.activeElement).toBe(node);
  } finally {
    vi.unstubAllGlobals();
  }
});
