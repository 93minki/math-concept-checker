"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import Link from "next/link";
import { defaultThemeSlug, themes } from "@/astryx-themes";
import { storedTheme, subscribeTheme } from "./theme-button";

function selectedMode(): "light" | "dark" | "system" {
  return storedTheme() ?? "system";
}
export default function AppTheme({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(
    subscribeTheme,
    selectedMode,
    (): "system" => "system",
  );
  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
