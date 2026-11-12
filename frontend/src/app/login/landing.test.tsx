import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import LoginPage from "./page";
import LoginDialog from "./login-dialog";
import LoginLayout from "./layout";
const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
  useRouter: () => ({
    replace: mocks.replace,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
const originalClose = HTMLDialogElement.prototype.close;
const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalMatches = HTMLDialogElement.prototype.matches;
beforeEach(() => {
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.matches = function (selector) {
    return selector === ":modal" ? false : originalMatches.call(this, selector);
  };
});
afterEach(() => {
  cleanup();
  mocks.replace.mockClear();
  HTMLDialogElement.prototype.close = originalClose;
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.matches = originalMatches;
});
test("랜딩과 머리말은 서비스 소개와 계정 링크를 보여 준다", async () => {
  render(
    <LoginLayout>
      {await LoginPage({ searchParams: Promise.resolve({}) })}
    </LoginLayout>,
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
  expect(
    screen.getByRole("banner").querySelector('a[href="/login?login=1"]')
      ?.textContent,
  ).toBe("로그인");
  expect(
    screen.getByRole("banner").querySelector('a[href="/signup"]')?.textContent,
  ).toBe("회원가입");
  expect(screen.queryByRole("dialog")).toBeNull();
  const preview = screen.getByRole("img", { name: "리포트 예시" });
  expect(within(preview).getByText("깊이 이해")).toBeTruthy();
  expect(within(preview).getAllByText("기본 이해")).toHaveLength(2);
  expect(within(preview).getByText("아직 이해 못 함")).toBeTruthy();
});
test("로그인 모달은 서버 렌더에서 열린 안전한 폼을 제공한다", async () => {
  const page = await LoginPage({
    searchParams: Promise.resolve({ login: "1" }),
  });
  const html = renderToStaticMarkup(page);
  expect(html).toMatch(/<dialog[^>]*\sopen=""/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);
  render(<LoginLayout>{page}</LoginLayout>);
  const dialog = screen.getByRole("dialog", { name: "로그인" });
  expect(within(dialog).getByLabelText("이메일")).toBeTruthy();
  expect(within(dialog).getByLabelText("비밀번호")).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "로그인" })).toBeTruthy();
  expect(dialog.querySelector("form")?.getAttribute("method")).toBe("post");
  expect(document.activeElement).toBe(within(dialog).getByLabelText("이메일"));
  fireEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
  expect(mocks.replace).toHaveBeenCalledWith("/login", { scroll: false });
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "로그인" }),
  );
});
test("Esc와 배경 클릭으로 모달을 닫는다", () => {
  const view = render(<LoginDialog />);
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { cancelable: true }),
  );
  expect(mocks.replace).toHaveBeenCalledWith("/login", { scroll: false });
  view.unmount();
  mocks.replace.mockClear();
  render(<LoginDialog />);
  fireEvent.click(screen.getByRole("dialog"), { clientX: -1, clientY: -1 });
  expect(mocks.replace).toHaveBeenCalledWith("/login", { scroll: false });
});
