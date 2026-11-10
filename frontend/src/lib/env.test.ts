import { expect, test } from "vitest";
import {
  parsePublicEnv,
  PublicEnvError,
  type RawPublicEnv,
} from "./env";

const validRaw: RawPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_EXAMPLE0000000000000000_abcd1234",
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
};

test("정상 값은 통과한다", () => {
  expect(parsePublicEnv(validRaw)).toEqual(validRaw);
});

test.each([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_API_BASE_URL",
] as const)("%s 가 없으면 그 키 이름으로 실패한다", (key) => {
  let thrown: unknown;
  try {
    parsePublicEnv({ ...validRaw, [key]: undefined });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(PublicEnvError);
  expect((thrown as PublicEnvError).message).toContain(key);
  expect((thrown as PublicEnvError).invalidKeys).toEqual([key]);
});

test("publishable 자리에 legacy JWT 키를 넣으면 실패하고 값은 에러에 없다", () => {
  const legacyKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake";
  let thrown: unknown;
  try {
    parsePublicEnv({
      ...validRaw,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacyKey,
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(PublicEnvError);
  const error = thrown as PublicEnvError;
  expect(error.message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(error.message).not.toContain(legacyKey);
  expect(error.invalidKeys).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
});

test("publishable 자리에 secret 키를 넣으면 실패하고 값은 에러에 없다", () => {
  const secretKey = "sb_secret_EXAMPLE0000000000000000_abcd1234";
  let thrown: unknown;
  try {
    parsePublicEnv({
      ...validRaw,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretKey,
    });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(PublicEnvError);
  const error = thrown as PublicEnvError;
  expect(error.message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  expect(error.message).not.toContain(secretKey);
  expect(error.invalidKeys).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
});
