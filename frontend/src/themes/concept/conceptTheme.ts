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
// Accent: violet, user decision 2026-11-13. OKLCH 0.50 0.19 290 (light) /
// 0.74 0.13 290 (dark), the hue of stone's tinted grays. Text on it:
// white 6.54:1 (light), #101018 7.94:1 (dark). Overriding --color-accent
// re-points accent-muted/text/icon; --color-on-accent must be set too.
const pair = (light: string, dark: string): [string, string] => [light, dark];
const accent = {
  "--color-accent": pair("#6744c5", "#aa9cf7"),
  "--color-on-accent": pair("#ffffff", "#101018"),
  // stone sets these explicitly, so they do not follow --color-accent.
  "--color-text-accent": pair("#6744c5", "#aa9cf7"),
  "--color-icon-accent": pair("#6744c5", "#aa9cf7"),
  "--color-accent-muted": pair("#6744c51f", "#aa9cf72e"),
};
const controls = {
  "--size-element-md": "44px",
  "--size-element-lg": "44px",
};
export const conceptTheme = defineTheme({
  name: "concept",
  extends: stoneTheme,
  // Desktop text matched to stone's touch scale: stone uses base 14px on
  // desktop and 16px on coarse pointers; users found desktop text too small
  // (2026-11-13). A child typography config replaces the parent's entirely.
  typography: {
    scale: { base: 16, ratio: 1.2225 },
    body: {
      family: "Pretendard Variable",
      fallbacks:
        "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    },
    heading: {
      family: "Pretendard Variable",
      fallbacks:
        "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    },
    code: {
      family: "ui-monospace",
      fallbacks: "SFMono-Regular, Menlo, monospace",
    },
  },
  tokens: { ...fonts, ...controls, ...accent },
  adaptations: {
    rules: [
      {
        when: { width: { below: "lg" }, pointer: "coarse" },
        value: { tokens: { ...fonts, ...controls } },
      },
    ],
  },
});
