import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import LandingPage from "./page";
import LandingLayout from "./layout";
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
afterEach(cleanup);
test("랜딩과 머리말은 서비스 소개와 계정 링크를 보여 준다", () => {
  render(
    <LandingLayout>
      <LandingPage />
    </LandingLayout>,
  );
  for (const title of [
    "점수 말고, 개념을 확인해요",
    "같은 시험, 다르게 보기",
    "맞힌 문제에도 빈틈이 있어요",
    "점수는 막힌 곳을 알려 주지 않아요",
    "다음에 무엇을 공부할지 좁혀져요",
    "단원 고르기",
    "기본 문제 풀기",
    "심화 문제 풀기",
    "리포트 보기",
  ])
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "시작하기" })).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "지금 바로 진단해 보세요" }),
  ).toBeNull();
  const header = screen.getByRole("banner");
  expect(
    within(header).getByRole("link", { name: "로그인" }).getAttribute("href"),
  ).toBe("/login");
  expect(
    within(header).getByRole("link", { name: "회원가입" }).getAttribute("href"),
  ).toBe("/signup");
  const sample = screen
    .getByRole("heading", { name: "샘플 리포트" })
    .closest(".astryx-card") as HTMLElement | null;
  expect(sample).toBeTruthy();
  expect(within(sample!).getByText("중1 · 문자의 사용과 식")).toBeTruthy();
  expect(within(sample!).getByText("예시")).toBeTruthy();
  expect(
    within(sample!).getByRole("heading", { name: "단원 이해", level: 4 }),
  ).toBeTruthy();
  expect(
    within(sample!).getByText(
      "아래 내용은 리포트가 어떻게 보이는지 알려 주는 예시예요.",
    ),
  ).toBeTruthy();
  expect(
    within(sample!).getByRole("heading", { name: "방정식과 항등식의 구별" }),
  ).toBeTruthy();
  expect(
    within(sample!).getByRole("progressbar", {
      name: "단원 이해 단계: 기본 이해",
    }),
  ).toBeTruthy();
});

test("랜딩 구역 순서와 개념 단계 막대를 표시한다", () => {
  render(<LandingPage />);
  const headings = screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
  const hero = screen
    .getByRole("heading", { name: "점수 말고, 개념을 확인해요" })
    .closest(".hero-panel");
  expect(
    hero?.contains(
      screen.getByRole("heading", { name: "같은 시험, 다르게 보기" }),
    ),
  ).toBe(false);
  expect(headings).toEqual([
    "같은 시험, 다르게 보기",
    "샘플 리포트",
    "이렇게 진단해요",
    "왜 개념을 확인해야 할까요?",
  ]);
  const bars = screen.getAllByRole("progressbar", {
    name: "등식의 뜻 이해 단계: 깊이 이해",
  });
  expect(bars).toHaveLength(2);
  expect(bars[0].getAttribute("aria-valuemax")).toBe("3");
});

test("채점표는 맞음 7개와 틀림 3개를 표시한다", () => {
  render(<LandingPage />);
  expect(screen.getAllByText("✓ 맞음")).toHaveLength(7);
  expect(screen.getAllByText("✗ 틀림")).toHaveLength(3);
});

test("히어로는 문구와 마스코트·미니 리포트를 함께 보인다", () => {
  render(<LandingPage />);
  const hero = screen
    .getByRole("heading", { name: "점수 말고, 개념을 확인해요" })
    .closest(".hero-panel")!;
  expect(
    within(hero as HTMLElement).getByText(
      "중학교 23개 단원 · 개념별 3단계 리포트",
    ),
  ).toBeTruthy();
  expect(hero.querySelector(".mascot-waving")).toBeTruthy();
  expect(
    within(hero as HTMLElement).getByRole("progressbar", {
      name: "등식의 뜻 예시 이해 단계: 깊이 이해",
    }),
  ).toBeTruthy();
  // No variant picker or carousel left behind.
  expect(screen.queryByRole("complementary", { name: "시안 선택" })).toBeNull();
  expect(screen.queryByRole("button", { name: "다음 슬라이드" })).toBeNull();
});
