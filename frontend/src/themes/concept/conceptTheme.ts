import { defineTheme } from "@astryxdesign/core/theme";
import { stoneTheme } from "@astryxdesign/theme-stone/built";

const fonts = {
  "--font-family-body":
    '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  "--font-family-heading":
    '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  "--font-family-code": "ui-monospace, SFMono-Regular, Menlo, monospace",
};
// Touch targets: buttons and inputs at least 44px (docs/DESIGN.md "화면",
// WCAG 2.2 2.5.5). Astryx core defaults are md 32px, lg 36px.
const controls = {
  "--size-element-md": "44px",
  "--size-element-lg": "44px",
};
export const conceptTheme = defineTheme({
  name: "concept",
  extends: stoneTheme,
  tokens: { ...fonts, ...controls },
  adaptations: {
    rules: [
      {
        when: { width: { below: "lg" }, pointer: "coarse" },
        value: { tokens: { ...fonts, ...controls } },
      },
    ],
  },
});
