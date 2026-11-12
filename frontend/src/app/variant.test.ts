import { expect, test, vi } from "vitest";
import { resolveVariant } from "./variant";

test("시안 값과 세션 보관 실패를 처리한다", () => {
  const storage = {
    getItem: vi.fn(() => "b"),
    setItem: vi.fn(),
  } as unknown as Storage;
  expect(resolveVariant("a", storage)).toBe("a");
  expect(resolveVariant("b", storage)).toBe("b");
  expect(resolveVariant("invalid", storage)).toBe("a");
  expect(resolveVariant(null, storage)).toBe("b");
  expect(
    resolveVariant("b", {
      setItem() {
        throw new Error();
      },
    } as unknown as Storage),
  ).toBe("a");
});
