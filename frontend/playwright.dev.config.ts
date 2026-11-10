import { defineConfig } from "@playwright/test";

for (const path of [".env.e2e", ".env.local"]) {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}

process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8000";

const required = [
  "E2E_USER_A_EMAIL", "E2E_USER_A_PASSWORD", "E2E_USER_B_EMAIL", "E2E_USER_B_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_API_BASE_URL",
] as const;
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) throw new Error(`필요한 환경 변수가 없습니다: ${missing.join(", ")}`);

export default defineConfig({
  testDir: "./e2e-dev",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: [
    // AI_MODE=fake: this suite must never call the real AI (AGENTS.md 5.4).
    { command: "uv run uvicorn app.main:app --port 8000", cwd: "../backend", url: "http://localhost:8000/health", reuseExistingServer: false, timeout: 180_000, env: { ...process.env, AI_MODE: "fake" } },
    { command: "pnpm build && pnpm start --port 3000", url: "http://localhost:3000/login", reuseExistingServer: false, timeout: 180_000, env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000" } },
  ],
  projects: [
    { name: "desktop", testMatch: /flow\.spec\.ts/, use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", testMatch: /flow\.spec\.ts/, use: { browserName: "chromium", viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "access", testMatch: /access\.spec\.ts/, use: { browserName: "chromium" } },
  ],
});
