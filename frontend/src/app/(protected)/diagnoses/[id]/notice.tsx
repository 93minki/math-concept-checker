"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function Notice({ children, role = "status", label }: { children: ReactNode; role?: "status" | "alert" | "dialog"; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <div ref={ref} role={role} aria-label={label} tabIndex={-1} className="unit-card stack">{children}</div>;
}
