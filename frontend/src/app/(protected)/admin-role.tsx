"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import StatusScreen from "@/components/status-screen";
import { getAdminMe } from "@/lib/reports-api";

export type AdminRole = "pending" | "admin" | "student";

const AdminContext = createContext<AdminRole>("student");

export function useAdminRole() {
  return useContext(AdminContext);
}

export function isStudentRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/history" ||
    pathname.startsWith("/history/") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname.startsWith("/diagnoses/")
  );
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole>("pending");
  useEffect(() => {
    let active = true;
    getAdminMe()
      .then((me) => {
        if (active) setRole(me.admin ? "admin" : "student");
      })
      .catch(() => {
        if (active) setRole("student");
      });
    return () => {
      active = false;
    };
  }, []);
  return <AdminContext.Provider value={role}>{children}</AdminContext.Provider>;
}

export function StudentBody({ children }: { children: ReactNode }) {
  const role = useAdminRole();
  const pathname = usePathname();
  const router = useRouter();
  const studentRoute = isStudentRoute(pathname);
  useEffect(() => {
    if (role === "admin" && studentRoute) router.replace("/admin/reports");
  }, [role, router, studentRoute]);
  // Students (almost everyone) render at once; only a confirmed admin is held
  // on a loading screen until the redirect, so student pages do not wait for
  // the role request.
  if (studentRoute && role === "admin")
    return <StatusScreen mood="waiting" title="불러오는 중이에요." live />;
  return children;
}
