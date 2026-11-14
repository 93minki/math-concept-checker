"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { ProblemText } from "@/components/problem-text";
import { Figure } from "@/components/figure";
import { ChoiceNumber } from "@/components/choice-number";
import { ApiError, authRedirect } from "@/lib/diagnosis-api";
import {
  approveRevision,
  createAIRevision,
  createManualRevision,
  getAdminQuestion,
  markInReview,
  reportKinds,
  reportStatuses,
  resolveNoIssue,
  type AdminDetails,
  type AdminQuestion,
  type ReportKind,
  type Revision,
} from "@/lib/reports-api";

function Preview({
  question,
  original,
}: {
  question: AdminQuestion;
  original?: AdminQuestion;
}) {
  return (
    <div className="admin-stack">
      <div className="problem-sheet stack">
        <div className="question">
          {original && question.body !== original.body && (
            <strong>본문 바뀜</strong>
          )}
          <ProblemText text={question.body} />
          {question.figure && <Figure figure={question.figure} />}
        </div>
        <div className="stack">
          {question.choices.map((choice) => (
            <div className="choice" key={choice.no}>
              <ChoiceNumber number={choice.no} />
              <div className="choice-content">
                {original &&
                  (() => {
                    const before = original.choices.find(
                      (c) => c.no === choice.no,
                    );
                    return (
                      !before ||
                      before.text !== choice.text ||
                      before.is_correct !== choice.is_correct ||
                      JSON.stringify(before.figure) !==
                        JSON.stringify(choice.figure)
                    );
                  })() && <strong>보기 {choice.no} 바뀜</strong>}
                <ProblemText text={choice.text} />
                {choice.figure && <Figure figure={choice.figure} />}
                {choice.is_correct && <strong>정답</strong>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <section className="reports-answer">
        <h3>정답·해설·채점 기준</h3>
        <div className="admin-stack">
          {question.model_answer && <p>모범 답안: {question.model_answer}</p>}
          <div>
            <strong>
              해설
              {original && question.explanation !== original.explanation
                ? " 바뀜"
                : ""}
            </strong>
            <ProblemText text={question.explanation} />
          </div>
          <div>
            <strong>채점 기준</strong>
            {question.rubric.map((r) => (
              <p key={r.no}>
                {r.no}. {r.description} ({r.points}점
                {r.required ? ", 필수" : ""})
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
export default function AdminQuestionView({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<AdminDetails | null>(null);
  const [draft, setDraft] = useState<AdminQuestion | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"ai" | string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null,
  );
  const revisions = [...(data?.revisions ?? [])].sort(
    (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
  const selectedRevision =
    revisions.find((r) => r.id === selectedRevisionId) ?? revisions[0];
  const previousRevisions = revisions.slice(1);
  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 403) router.replace("/");
      else if (!authRedirect(e, router.push))
        setError("처리하지 못했어요. 다시 시도해 주세요.");
    },
    [router],
  );
  const load = useCallback(async () => {
    try {
      const result = await getAdminQuestion(id);
      setData(result);
      setDraft({
        ...result.question,
        choices: result.choices,
        rubric: result.rubric.map((r) => ({
          ...r,
          related_misconception_ids: result.rubric_links
            .filter((link) => link.rubric_element_id === r.id)
            .map((link) => link.misconception_id),
        })),
      });
    } catch (e) {
      fail(e);
    }
  }, [id, fail]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      setConfirm(null);
      setSelectedRevisionId(null);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="study-page admin-stack reports-ui">
      <h1>신고 문항 관리</h1>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && draft && (
        <>
          <p className="reports-muted">
            {data.unit
              ? `${data.unit.grade} · ${data.unit.number}. ${data.unit.name}`
              : "단원 정보 없음"}{" "}
            · {data.assessment_item.name}
          </p>
          <div className="reports-detail-layout">
            <section className="admin-stack reports-detail-question">
              <h2>원래 문제</h2>
              <Preview
                question={{
                  ...data.question,
                  choices: data.choices,
                  rubric: data.rubric.map((r) => ({
                    ...r,
                    related_misconception_ids: data.rubric_links
                      .filter((l) => l.rubric_element_id === r.id)
                      .map((l) => l.misconception_id),
                  })),
                }}
              />
            </section>
            <aside className="admin-stack reports-detail-panel">
              <h2>신고 목록</h2>
              <div className="reports-chips" aria-label="신고 유형">
                {(Object.keys(reportKinds) as ReportKind[]).map((value) => {
                  const count = data.reports.filter(
                    (r) => r.kind === value,
                  ).length;
                  return count ? (
                    <button
                      type="button"
                      className="reports-filter-chip"
                      key={value}
                      aria-pressed={kind === value}
                      onClick={() => setKind(kind === value ? null : value)}
                    >
                      {reportKinds[value]} {count}
                    </button>
                  ) : null;
                })}
              </div>
              <h2>신고 처리</h2>
              <Button
                variant={
                  data.reports.some(
                    (r) => r.status === "received" || r.status === "in_review",
                  )
                    ? "primary"
                    : "secondary"
                }
                label="AI 수정안 만들기"
                onClick={() => setConfirm("ai")}
                isDisabled={busy}
              />
              <Button label="직접 수정" onClick={() => setEditing(!editing)} />
              <Button
                label="처리 중으로"
                onClick={() =>
                  void run(() => markInReview(id), "처리 중으로 변경했어요.")
                }
                isDisabled={busy}
              />
              <label>
                문제 없음 메모
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <Button
                label="문제 없음"
                onClick={() =>
                  void run(
                    () => resolveNoIssue(id, note),
                    "문제 없음으로 처리했어요.",
                  )
                }
                isDisabled={busy}
              />
              {editing && (
                <section className="admin-editor">
                  <h2>직접 수정</h2>
                  <label>
                    문제 본문
                    <textarea
                      value={draft.body}
                      onChange={(e) =>
                        setDraft({ ...draft, body: e.target.value })
                      }
                    />
                  </label>
                  {draft.choices.map((choice, index) => (
                    <fieldset key={choice.no}>
                      <legend>보기 {choice.no}</legend>
                      <label>
                        내용
                        <textarea
                          value={choice.text}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              choices: draft.choices.map((c, i) =>
                                i === index
                                  ? { ...c, text: e.target.value }
                                  : c,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="correct-choice"
                          checked={choice.is_correct}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              choices: draft.choices.map((c, i) => ({
                                ...c,
                                is_correct: i === index,
                              })),
                            })
                          }
                        />
                        정답
                      </label>
                    </fieldset>
                  ))}
                  <label>
                    모범 답안
                    <textarea
                      value={draft.model_answer ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, model_answer: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    해설
                    <textarea
                      value={draft.explanation}
                      onChange={(e) =>
                        setDraft({ ...draft, explanation: e.target.value })
                      }
                    />
                  </label>
                  {draft.rubric.map((r, index) => (
                    <fieldset key={r.no}>
                      <legend>채점 요소 {r.no}</legend>
                      <label>
                        내용
                        <textarea
                          value={r.description}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rubric: draft.rubric.map((x, i) =>
                                i === index
                                  ? { ...x, description: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        점수
                        <input
                          type="number"
                          value={r.points}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rubric: draft.rubric.map((x, i) =>
                                i === index
                                  ? { ...x, points: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={r.required}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rubric: draft.rubric.map((x, i) =>
                                i === index
                                  ? { ...x, required: e.target.checked }
                                  : x,
                              ),
                            })
                          }
                        />
                        필수
                      </label>
                    </fieldset>
                  ))}
                  <Button
                    label="수정안 저장"
                    onClick={() =>
                      void run(
                        () => createManualRevision(id, draft),
                        "수정안을 저장했어요.",
                      )
                    }
                    isDisabled={busy}
                  />
                </section>
              )}

              <ReportEntries
                key={kind ?? "all"}
                reports={data.reports}
                kind={kind}
              />
            </aside>
            <section className="admin-stack reports-revisions">
              <h2>수정안 목록</h2>
              {revisions.some((r) => r.status === "approved") && (
                <p className="reports-approved">승인됨 — 새 문제로 교체됨</p>
              )}
              {selectedRevision &&
                [selectedRevision].map((revision) => (
                  <article
                    className="admin-stack reports-revision"
                    key={revision.id}
                  >
                    <div className="reports-chips">
                      <h3>
                        {revision.source === "ai" ? "AI 수정안" : "직접 수정안"}
                      </h3>
                      <RevisionBadge revision={revision} />
                    </div>
                    {revision.checks.map((check, index) =>
                      "issues" in check ? (
                        <div key={index}>
                          <p>
                            검사 {check.number}:{" "}
                            {check.issues.length ? "실패" : "통과"}
                          </p>
                          {check.issues.map((issue, i) => (
                            <p key={i}>{issue}</p>
                          ))}
                        </div>
                      ) : (
                        <div key={index}>
                          <p>
                            {check.decision === "no_change"
                              ? "AI 판단: 고칠 필요 없음"
                              : "AI 판단: 수정"}
                          </p>
                          <p>{check.reason}</p>
                          {check.decision === "no_change" && (
                            <NoChange
                              reason={check.reason}
                              busy={busy}
                              close={(reason) =>
                                void run(
                                  () => resolveNoIssue(id, reason),
                                  "문제 없음으로 처리했어요.",
                                )
                              }
                            />
                          )}
                        </div>
                      ),
                    )}
                    {revision.checks.some(
                      (check) =>
                        "decision" in check && check.decision === "no_change",
                    ) ? null : (
                      <div className="admin-columns">
                        <div>
                          <h4>원래 문제</h4>
                          <Preview
                            question={{
                              ...data.question,
                              choices: data.choices,
                              rubric: data.rubric.map((r) => ({
                                ...r,
                                related_misconception_ids: [],
                              })),
                            }}
                          />
                        </div>
                        <div>
                          <h4>수정안</h4>
                          <Preview
                            question={revision.payload}
                            original={{
                              ...data.question,
                              choices: data.choices,
                              rubric: data.rubric.map((r) => ({
                                ...r,
                                related_misconception_ids: [],
                              })),
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {revision.status === "passed" && (
                      <Button
                        label="승인"
                        onClick={() => setConfirm(revision.id)}
                        isDisabled={busy}
                      />
                    )}
                  </article>
                ))}
              {selectedRevisionId &&
                selectedRevisionId !== revisions[0]?.id && (
                  <button
                    type="button"
                    className="reports-history-button"
                    onClick={() => setSelectedRevisionId(null)}
                  >
                    최신 수정안으로
                  </button>
                )}
              {previousRevisions.length > 0 && (
                <details className="reports-revision-history">
                  <summary>이전 수정안 {previousRevisions.length}개</summary>
                  <div>
                    {previousRevisions.map((revision) => (
                      <button
                        key={revision.id}
                        type="button"
                        className="reports-history-row"
                        aria-pressed={selectedRevision?.id === revision.id}
                        onClick={() => setSelectedRevisionId(revision.id)}
                      >
                        <span>{revision.source === "ai" ? "AI" : "직접"}</span>
                        <RevisionBadge revision={revision} />
                        <time>
                          {revision.created_at
                            ? new Date(revision.created_at).toLocaleString(
                                "ko-KR",
                              )
                            : ""}
                        </time>
                        {revision.checks.map((check, i) =>
                          "decision" in check &&
                          check.decision === "no_change" ? (
                            <span className="reports-history-reason" key={i}>
                              {check.reason}
                            </span>
                          ) : null,
                        )}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>
          </div>
        </>
      )}
      <Dialog
        isOpen={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
        purpose="form"
        width={440}
        maxHeight="85dvh"
      >
        <Layout
          header={
            <DialogHeader
              title={confirm === "ai" ? "AI 수정안 만들기" : "수정안 승인"}
            />
          }
          content={
            <LayoutContent>
              <p>
                {confirm === "ai"
                  ? "AI 수정안 생성에는 비용이 듭니다. 계속할까요?"
                  : "이 수정안을 승인할까요?"}
              </p>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              {/* Same footer as the other dialogs: gap, right-aligned,
                  secondary cancel and a primary action (user 2026-11-15). */}
              <HStack gap={2} hAlign="end">
                <Button
                  label="취소"
                  variant="secondary"
                  onClick={() => setConfirm(null)}
                  isDisabled={busy}
                />
                <Button
                  label={confirm === "ai" ? "만들기" : "승인"}
                  variant="primary"
                  isLoading={busy}
                  onClick={() => {
                    if (confirm === "ai")
                      void run(
                        () => createAIRevision(id),
                        "AI 수정안을 만들었어요.",
                      );
                    else if (confirm)
                      void run(
                        () => approveRevision(confirm),
                        "승인했어요. 백업 파일 내보내기 필요 (app.bank export)",
                      );
                  }}
                  isDisabled={busy}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </main>
  );
}

function NoChange({
  reason,
  busy,
  close,
}: {
  reason: string;
  busy: boolean;
  close: (reason: string) => void;
}) {
  const [note, setNote] = useState(reason);
  return (
    <div className="admin-stack">
      <label>
        문제 없음 메모
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button
        label="문제 없음으로 닫기"
        onClick={() => close(note)}
        isDisabled={busy}
      />
    </div>
  );
}

function RevisionBadge({ revision }: { revision: Revision }) {
  const label =
    revision.status === "passed"
      ? "검사 통과"
      : revision.status === "failed"
        ? "검사 실패"
        : revision.status === "discarded"
          ? "수정 없음"
          : revision.status === "approved"
            ? "승인됨"
            : "임시";
  return (
    <Badge
      label={label}
      variant={
        revision.status === "passed"
          ? "success"
          : revision.status === "failed"
            ? "error"
            : "neutral"
      }
    />
  );
}

type Report = AdminDetails["reports"][number];
function ReportEntries({
  reports,
  kind,
}: {
  reports: Report[];
  kind: ReportKind | null;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const [openLimit, setOpenLimit] = useState(5);
  const [closedLimit, setClosedLimit] = useState(5);
  const [expanded, setExpanded] = useState<string[]>([]);
  const filtered = reports
    .filter((r) => !kind || r.kind === kind)
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const open = filtered.filter(
    (r) => r.status === "received" || r.status === "in_review",
  );
  const closed = filtered.filter(
    (r) => r.status === "fixed" || r.status === "no_issue",
  );
  function entries(items: Report[], limit: number) {
    return items.slice(0, limit).map((report) => (
      <article className="reports-panel-entry" key={report.id}>
        <div className="reports-chips">
          <span className="reports-chip">{reportKinds[report.kind]}</span>
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
        </div>
        {report.description && (
          <>
            <p
              className={`report-description${expanded.includes(report.id) ? "" : " reports-clamp"}`}
            >
              {report.description}
            </p>
            <button
              type="button"
              className="reports-text-toggle"
              aria-expanded={expanded.includes(report.id)}
              onClick={() =>
                setExpanded(
                  expanded.includes(report.id)
                    ? expanded.filter((id) => id !== report.id)
                    : [...expanded, report.id],
                )
              }
            >
              {expanded.includes(report.id) ? "설명 접기" : "설명 펼치기"}
            </button>
          </>
        )}
        <time className="reports-muted" dateTime={report.created_at}>
          {new Date(report.created_at).toLocaleString("ko-KR")}
        </time>
      </article>
    ));
  }
  return (
    <div className="admin-stack reports-entries">
      <h3>열린 신고 {open.length}개</h3>
      {entries(open, openLimit)}
      {open.length > openLimit && (
        <Button label="더 보기" onClick={() => setOpenLimit(openLimit + 5)} />
      )}
      <button
        type="button"
        className="reports-history-button"
        aria-expanded={showClosed}
        onClick={() => setShowClosed(!showClosed)}
      >
        지난 신고 {closed.length}개 보기
      </button>
      {showClosed && (
        <div className="admin-stack">
          {entries(closed, closedLimit)}
          {closed.length > closedLimit && (
            <Button
              label="지난 신고 더 보기"
              onClick={() => setClosedLimit(closedLimit + 5)}
            />
          )}
        </div>
      )}
    </div>
  );
}
