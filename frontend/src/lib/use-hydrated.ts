import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server-rendered HTML, true once React runs in the browser.
 * Forms that handle credentials keep their submit button disabled until then,
 * so the browser never falls back to a native submit that could put the
 * password in the URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
