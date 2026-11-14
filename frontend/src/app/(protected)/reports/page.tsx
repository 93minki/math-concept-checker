"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import StatusScreen from "@/components/status-screen";
import { authRedirect } from "@/lib/diagnosis-api";
import {
  getMyReports,
  reportKinds,
  reportStatuses,
  type StudentReport,
} from "@/lib/reports-api";
export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<StudentReport[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    getMyReports()
      .then((rows) => {
        if (active) setReports(rows);
      })
      .catch((e) => {
        if (active && !authRedirect(e, router.push))
          setError("신고 목록을 불러오지 못했어요. 새로고침해 주세요.");
      });
    return () => {
      active = false;
    };
  }, [router]);
  return (
    <main className="study-page reports-page">
      <h1>내 신고</h1>
      {error && <p role="alert">{error}</p>}
      {!reports && !error && (
        <StatusScreen
          mood="waiting"
          title="신고를 불러오고 있어요."
          live
          compact
        />
      )}
      {reports?.length === 0 && (
        <StatusScreen
          mood="waving"
          title="아직 신고한 문제가 없어요"
          description="문제를 풀다가 오류를 발견하면 알려 주세요."
        />
      )}
      {reports && reports.length > 0 && (
        <div className="report-list">
          {reports.map((report) => {
            const item = report.diagnosis_items;
            const unit = item?.diagnoses?.display_units;
            return (
              <Card key={report.id}>
                <article className="report-entry">
                  <div>
                    <h2>
                      {unit
                        ? `${unit.grade} · ${unit.number}. ${unit.name}`
                        : "단원 정보 없음"}
                    </h2>
                    <p>
                      {item
                        ? `${item.stage}단계 · ${item.position}번`
                        : "진단 문항 정보 없음"}{" "}
                      · {reportKinds[report.kind]}
                    </p>
                  </div>
                  <Badge
                    label={reportStatuses[report.status]}
                    variant={
                      report.status === "fixed"
                        ? "success"
                        : report.status === "in_review"
                          ? "info"
                          : "neutral"
                    }
                  />
                  <p>
                    신고 {new Date(report.created_at).toLocaleString("ko-KR")}
                    {report.resolved_at &&
                      ` · 처리 ${new Date(report.resolved_at).toLocaleString("ko-KR")}`}
                  </p>
                  {report.description && (
                    <p className="report-description">{report.description}</p>
                  )}
                </article>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
