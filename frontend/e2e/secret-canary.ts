import { randomUUID } from "node:crypto";

// A throwaway value passed to the build as SUPABASE_SECRET_KEY so the
// build-secrets check can prove server-only values never reach .next/.
// It is generated per test run and never stored in the repo: a committed
// value that looks like a real key trips secret scanners (GitGuardian
// flagged the earlier hardcoded one) even though it grants no access.
// The config sets it once in the main process; workers inherit the env.
const CANARY_ENV = "E2E_SECRET_CANARY";

export function secretCanary(): string {
  process.env[CANARY_ENV] ??= `e2e-canary-${randomUUID()}`;
  return process.env[CANARY_ENV];
}
