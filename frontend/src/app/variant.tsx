"use client";

import { useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Variant = "a" | "b";
export const VariantContext = createContext<Variant>("a");

export function resolveVariant(
  value: string | null,
  storage: Storage,
): Variant {
  try {
    const variant = value === null ? storage.getItem("variant") : value;
    const result = variant === "b" ? "b" : "a";
    storage.setItem("variant", result);
    return result;
  } catch {
    return "a";
  }
}

export function VariantProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const variant = useSyncExternalStore(
    (notify) => {
      window.addEventListener("variant-change", notify);
      return () => window.removeEventListener("variant-change", notify);
    },
    () => (document.documentElement.dataset.variant === "b" ? "b" : "a"),
    () => "a" as Variant,
  );
  useEffect(() => {
    let next: Variant = "a";
    try {
      next = resolveVariant(params.get("variant"), window.sessionStorage);
    } catch {
      next = "a";
    }
    document.documentElement.dataset.variant = next;
    window.dispatchEvent(new Event("variant-change"));
  }, [params]);
  return (
    <VariantContext.Provider value={variant}>
      {children}
    </VariantContext.Provider>
  );
}

export function useVariant() {
  return useContext(VariantContext);
}
