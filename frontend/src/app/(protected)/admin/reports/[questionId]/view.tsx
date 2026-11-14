"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
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
} from "@/lib/reports-api";

function Preview({
  question,
  original,
  collapsible = false,
}: {
  question: AdminQuestion;
  original?: AdminQuestion;
  collapsible?: boolean;
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
                {choice.is_correct && !collapsible && <strong>정답</strong>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <details className="reports-answer" open={!collapsible}>
        <summary>정답·해설·채점 기준</summary>
        <div className="admin-stack">
          {collapsible &&
            question.choices.some((choice) => choice.is_correct) && (
              <p>
                정답:{" "}
                {question.choices
                  .filter((choice) => choice.is_correct)
                  .map((choice) => `${choice.no}번`)
                  .join(", ")}
              </p>
            )}
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
      </details>
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
                collapsible
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
              {data.reports.map((report) => (
                <article className="reports-panel-entry" key={report.id}>
                  <div className="reports-chips">
                    <span className="reports-chip">
                      {reportKinds[report.kind]}
                    </span>
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
                  <p className="report-description">{report.description}</p>
                  <p className="reports-muted">
                    {new Date(report.created_at).toLocaleString("ko-KR")}
                  </p>
                </article>
              ))}
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

              <section className="admin-stack">
                <h2>수정안 목록</h2>
                {data.revisions.map((revision) => (
                  <article
                    className="admin-stack reports-revision"
                    key={revision.id}
                  >
                    <div className="reports-chips">
                      <h3>
                        {revision.source === "ai" ? "AI 수정안" : "직접 수정안"}
                      </h3>
                      <Badge
                        label={
                          revision.status === "passed"
                            ? "검사 통과"
                            : revision.status === "failed"
                              ? "검사 실패"
                              : revision.status === "discarded"
                                ? "수정 없음"
                                : revision.status === "approved"
                                  ? "승인됨"
                                  : "임시"
                        }
                        variant={
                          revision.status === "passed"
                            ? "success"
                            : revision.status === "failed"
                              ? "error"
                              : "neutral"
                        }
                      />
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
              </section>
            </aside>
          </div>
        </>
      )}
      <Dialog
        isOpen={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
        purpose="form"
        width={560}
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
              <Button
                label="취소"
                onClick={() => setConfirm(null)}
                isDisabled={busy}
              />
              <Button
                label="확인"
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
