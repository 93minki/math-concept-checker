import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const unitName = "문자의 사용과 식";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`필요한 환경 변수가 없습니다: ${name}`);
  return value;
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "진단할 단원을 골라요" }),
  ).toBeVisible();
}

export async function tokenFor(email: string, password: string) {
  const client = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session || !data.user)
    throw new Error("시험 계정 로그인 실패");
  return {
    client,
    accessToken: data.session.access_token,
    userId: data.user.id,
  };
}

export async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
}
