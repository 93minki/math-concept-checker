import { renderToStaticMarkup } from "react-dom/server";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import LoginForm from "./login/login-form";
import LoginLayout from "./login/layout";
import SignupLayout from "./signup/layout";
import SignupPage from "./signup/page";
import HomeActions from "./(protected)/home-actions";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  pathname: "/login",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: mocks }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mocks.pathname,
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

test("로그인 제출과 실패 안내", async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: new Error("internal") });
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await waitFor(() =>
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    }),
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "이메일 또는 비밀번호를 확인해 주세요.",
  );
});

test("로그인에 성공하면 보호된 첫 화면으로 간다", async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("카카오 로그인은 콜백 주소를 전달한다", async () => {
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  render(<LoginForm />);
  fireEvent.click(screen.getByRole("button", { name: "카카오로 시작하기" }));
  await waitFor(() =>
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    }),
  );
});

test("회원가입은 확인 메일 콜백을 설정하고 안내한다", async () => {
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  const { container } = render(<SignupPage />);
  const consent = screen.getByRole("checkbox", {
    name: /개인정보 수집·이용에 동의합니다 \(필수\)/,
  });
  const submit = screen.getByRole("button", {
    name: "가입하기",
  }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(consent.closest("form")).toBe(container.querySelector("form"));
  expect((consent as HTMLInputElement).required).toBe(true);
  for (const heading of [
    "받는 정보",
    "쓰는 목적",
    "맡기는 곳",
    "보관과 삭제",
    "동의를 거부할 수 있어요",
  ])
    expect(screen.getByText(heading)).toBeTruthy();
  expect(
    screen.getByRole("region", { name: "개인정보 수집·이용 동의 내용" })
      .textContent,
  ).toContain("연락처는 서비스 공개 전에 안내할 예정이에요.");
  fireEvent.click(consent);
  expect(submit.disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("이메일"), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText("비밀번호"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "가입하기" }));
  expect(sessionStorage.getItem("privacy-consent")).toBe("agreed");
  await waitFor(() =>
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    }),
  );
  await waitFor(() => {
    expect(
      screen
        .getAllByRole("status")
        .some(
          (el) =>
            el.textContent ===
            "확인 메일을 보냈어요. 메일의 링크를 눌러 주세요.",
        ),
    ).toBe(true);
  });
});

test("회원가입 카카오는 동의 뒤에만 시작하고 동의를 저장한다", async () => {
  mocks.signInWithOAuth.mockResolvedValue({ error: null });
  render(<SignupPage />);
  const kakao = screen.getByRole("button", { name: "카카오로 시작하기" });
  expect(kakao.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(kakao);
  expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("privacy-consent")).toBeNull();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /개인정보 수집·이용에 동의합니다 \(필수\)/,
    }),
  );
  expect(kakao.getAttribute("aria-disabled")).toBeNull();
  fireEvent.click(kakao);
  expect(sessionStorage.getItem("privacy-consent")).toBe("agreed");
  await waitFor(() =>
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    }),
  );
});

test("로그아웃 성공 시 랜딩으로 이동한다", async () => {
  mocks.signOut.mockResolvedValue({ error: null });
  render(<HomeActions />);
  fireEvent.click(screen.getAllByRole("button", { name: "로그아웃" })[0]);
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/"));
});

test("로그아웃 실패 시 쉬운 안내를 보여 준다", async () => {
  mocks.signOut.mockResolvedValue({ error: new Error("internal") });
  render(<HomeActions />);
  fireEvent.click(screen.getAllByRole("button", { name: "로그아웃" })[0]);
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "로그아웃하지 못했어요. 다시 시도해 주세요.",
  );
});

test.each([
  ["로그인", () => <LoginForm />],
  ["회원가입", () => <SignupPage />],
])(
  "%s 폼은 POST라서 기본 전송이 일어나도 비밀번호가 주소에 붙지 않는다",
  (_, page) => {
    const { container } = render(page());
    expect(container.querySelector("form")?.getAttribute("method")).toBe(
      "post",
    );
  },
);

test.each([
  ["/login", LoginLayout, "로그인"],
  ["/signup", SignupLayout, "회원가입"],
  ["/signup/complete", SignupLayout, null],
] as const)(
  "%s 인증 머리말의 계정 링크와 현재 페이지 표시",
  (path, Layout, current) => {
    mocks.pathname = path;
    render(
      <Layout>
        <div>화면</div>
      </Layout>,
    );
    expect(
      screen.getByRole("link", { name: "수학 개념 체커" }).getAttribute("href"),
    ).toBe("/");
    // The icon is decorative: the link is still named by its text.
    expect(
      screen
        .getByRole("link", { name: "수학 개념 체커" })
        .querySelector('svg.brand-mark[aria-hidden="true"]'),
    ).not.toBeNull();
    const login = screen.getByRole("link", { name: "로그인" });
    const signup = screen.getByRole("link", { name: "회원가입" });
    expect(login.getAttribute("href")).toBe("/login");
    expect(signup.getAttribute("href")).toBe("/signup");
    expect(login.getAttribute("aria-current")).toBe(
      current === "로그인" ? "page" : null,
    );
    expect(signup.getAttribute("aria-current")).toBe(
      current === "회원가입" ? "page" : null,
    );
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeTruthy();
  },
);

test.each([
  ["로그인", LoginForm],
  ["회원가입", SignupPage],
])("%s 서버 HTML의 인증 폼은 안전하다", (_, Component) => {
  const doc = new DOMParser().parseFromString(
    renderToStaticMarkup(<Component />),
    "text/html",
  );
  const form = doc.querySelector("form");
  expect(form?.getAttribute("method")).toBe("post");
  expect(
    form?.querySelector<HTMLInputElement>('input[name="email"]')?.required,
  ).toBe(true);
  expect(
    form?.querySelector<HTMLInputElement>('input[name="password"]')?.required,
  ).toBe(true);
  expect(
    form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
  ).toBe(true);
});
