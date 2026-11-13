"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Banner } from "@astryxdesign/core/Banner";

export default function Notice({
  children,
  role = "status",
  label,
}: {
  children: ReactNode;
  role?: "status" | "alert" | "dialog";
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} role={role} aria-label={label} tabIndex={-1}>
      {typeof children === "string" ? (
        <Banner status={role === "alert" ? "error" : "info"} title={children} />
      ) : (
        <Banner
          status={role === "alert" ? "error" : "info"}
          title="안내"
          collapsible={false}
        >
          {children}
        </Banner>
      )}
    </div>
  );
}
