"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@astryxdesign/core/Badge";
import StatusScreen from "@/components/status-screen";
import { ApiError, authRedirect } from "@/lib/diagnosis-api";
import {
  getAdminReports,
  reportStatuses,
  type AdminGroup,
  type ReportStatus,
} from "@/lib/reports-api";

const statuses: (ReportStatus | "")[] = [
  "",
  "received",
  "in_review",
  "fixed",
  "no_issue",
];
export default function AdminReportsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [rows, setRows] = useState<AdminGroup[] | null>(null);
  const [allRows, setAllRows] = useState<AdminGroup[] | null>(null);
  const [error, setError] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    let active = true;
    getAdminReports(status || undefined)
      .then((data) => {
        if (active) {
          setRows(data);
          if (!status) setAllRows(data);
        }
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
  function select(value: ReportStatus | "") {
    if (status !== value) {
      setRows(null);
      setError("");
      setStatus(value);
    }
  }
  return (
    <main className="study-page admin-stack reports-ui">
      <header className="reports-heading">
        <h1>신고 관리</h1>
        <p>신고된 문제를 살펴보고 처리해 주세요.</p>
      </header>
      <section className="reports-filter">
        <div role="tablist" aria-label="신고 상태" className="reports-tabs">
          {statuses.map((value, index) => (
            <button
              key={value}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              role="tab"
              aria-selected={status === value}
              aria-controls="reports-results"
              tabIndex={status === value ? 0 : -1}
              onClick={() => select(value)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const next =
                  (index +
                    (e.key === "ArrowRight" ? 1 : -1) +
                    statuses.length) %
                  statuses.length;
                select(statuses[next]);
                tabs.current[next]?.focus();
              }}
            >
              <span>{value ? reportStatuses[value] : "전체"}</span>
              <span>
                {allRows
                  ? value
                    ? allRows.filter((row) => row.statuses.includes(value))
                        .length
                    : allRows.length
                  : "–"}
              </span>
            </button>
          ))}
        </div>
        <p className="reports-muted">
          문항 기준 · 한 문항에 여러 상태가 있을 수 있어요.
        </p>
      </section>
      <div
        id="reports-results"
        role="tabpanel"
        aria-label={status ? reportStatuses[status] : "전체"}
      >
        {error && <p role="alert">{error}</p>}
        {!rows && !error && (
          <StatusScreen
            mood="waiting"
            title="신고를 불러오고 있어요."
            live
            compact
          />
        )}
        {rows?.length === 0 && (
          <StatusScreen
            mood="waving"
            title="신고가 없어요"
            description="이 상태로 접수된 문항이 없어요."
          />
        )}
        {rows && rows.length > 0 && (
          <div className="reports-rows">
            {rows.map((row) => (
              <Link
                className="reports-admin-row"
                href={`/admin/reports/${row.question_id}`}
                key={row.question_id}
              >
                <div className="reports-row-main">
                  <p className="reports-muted">
                    {row.unit
                      ? `${row.unit.grade} · ${row.unit.number}. ${row.unit.name}`
                      : "단원 정보 없음"}{" "}
                    · {row.assessment_item.name}
                  </p>
                  <h2>{row.body_summary}</h2>
                </div>
                <div className="reports-row-meta">
                  <div className="reports-chips">
                    <span className="reports-chip">
                      신고 {row.report_count}건
                    </span>
                    {row.statuses.map((s) => (
                      <Badge
                        key={s}
                        label={reportStatuses[s]}
                        variant={
                          s === "fixed"
                            ? "success"
                            : s === "in_review"
                              ? "info"
                              : "neutral"
                        }
                      />
                    ))}
                  </div>
                  <time
                    className="reports-muted"
                    dateTime={row.latest_report_at}
                  >
                    최근{" "}
                    {new Date(row.latest_report_at).toLocaleString("ko-KR")}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
