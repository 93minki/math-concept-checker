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
  const preview = screen.getByRole("img", { name: "리포트 예시" });
  expect(within(preview).getByText("깊이 이해")).toBeTruthy();
  expect(within(preview).getAllByText("기본 이해")).toHaveLength(2);
  expect(within(preview).getByText("아직 이해 못 함")).toBeTruthy();
});
