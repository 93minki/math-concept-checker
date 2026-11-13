import { defineTheme } from "@astryxdesign/core/theme";
import { stoneTheme } from "@astryxdesign/theme-stone/built";

const fonts = {
  "--font-family-body":
    '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  "--font-family-heading":
    '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  "--font-family-code": "ui-monospace, SFMono-Regular, Menlo, monospace",
};
export const conceptTheme = defineTheme({
  name: "concept",
  extends: stoneTheme,
  tokens: fonts,
  adaptations: {
    rules: [
      {
        when: { width: { below: "lg" }, pointer: "coarse" },
        value: { tokens: fonts },
      },
    ],
  },
});
