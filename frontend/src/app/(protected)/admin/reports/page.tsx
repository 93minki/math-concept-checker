"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, authRedirect } from "@/lib/diagnosis-api";
import {
  getAdminReports,
  reportStatuses,
  type AdminGroup,
  type ReportStatus,
} from "@/lib/reports-api";

export default function AdminReportsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [rows, setRows] = useState<AdminGroup[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getAdminReports(status || undefined)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 403) router.replace("/");
        else if (!authRedirect(e, router.push))
          setError("신고 목록을 불러오지 못했어요.");
      });
    return () => {
      active = false;
    };
  }, [router, status]);
  return (
    <main className="study-page admin-stack">
      <h1>신고 관리</h1>
      <label>
        상태{" "}
        <select
          value={status}
          onChange={(e) => {
            setRows(null);
            setError("");
            setStatus(e.target.value as ReportStatus | "");
          }}
        >
          <option value="">전체</option>
          {Object.entries(reportStatuses).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <p>불러오는 중이에요.</p>}
      {rows?.length === 0 && <p>신고가 없어요.</p>}
      <div className="report-list">
        {rows?.map((row) => (
          <article key={row.question_id} className="admin-report-row">
            <Link href={`/admin/reports/${row.question_id}`}>
              <h2>
                {row.unit
                  ? `${row.unit.grade} · ${row.unit.number}. ${row.unit.name}`
                  : "단원 정보 없음"}
              </h2>
              <p>{row.assessment_item.name}</p>
              <p>{row.body_summary}</p>
            </Link>
            <p>
              신고 {row.report_count}건 · 최근{" "}
              {new Date(row.latest_report_at).toLocaleString("ko-KR")}
            </p>
            <p>{row.statuses.map((s) => reportStatuses[s]).join(" · ")}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
