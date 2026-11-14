import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import Mascot, { type MascotMood } from "./mascot";

afterEach(cleanup);

test.each([
  ["thinking", "gaenyeom-thinking.png"],
  ["resting", "gaenyeom-resting.png"],
  ["waving", "gaenyeom-cheer.png"],
  ["waiting", "gaenyeom-waiting.png"],
] as const)("개념이 %s는 자기 그림을 장식으로 보인다", (mood, file) => {
  const { container } = render(<Mascot mood={mood as MascotMood} />);
  const wrapper = container.querySelector(`.mascot-${mood}`);
  expect(wrapper?.getAttribute("aria-hidden")).toBe("true");
  const img = wrapper?.querySelector("img");
  expect(img?.getAttribute("alt")).toBe("");
  expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(file);
});
