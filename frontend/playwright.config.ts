import { defineConfig } from "@playwright/test";
import { secretCanary } from "./e2e/secret-canary";

// E2E_PORT lets the suite run while `pnpm dev` already holds port 3000.
const port = process.env.E2E_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL,
  },
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    env: {
      SUPABASE_SECRET_KEY: secretCanary(),
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:9",
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
