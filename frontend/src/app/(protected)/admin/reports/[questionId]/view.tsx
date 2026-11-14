"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
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

function Preview({ question }: { question: AdminQuestion }) {
  return (
    <div className="admin-stack">
      <div className="problem-sheet stack">
        <div className="question">
          <ProblemText text={question.body} />
          {question.figure && <Figure figure={question.figure} />}
        </div>
        <div className="stack">
          {question.choices.map((choice) => (
            <div className="choice" key={choice.no}>
              <ChoiceNumber number={choice.no} />
              <div className="choice-content">
                <ProblemText text={choice.text} />
                {choice.figure && <Figure figure={choice.figure} />}
                {choice.is_correct && <strong>정답</strong>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {question.model_answer && <p>모범 답안: {question.model_answer}</p>}
      <div>
        <strong>해설</strong>
        <ProblemText text={question.explanation} />
      </div>
      <div>
        <strong>채점 기준</strong>
        {question.rubric.map((r) => (
          <p key={r.no}>
            {r.no}. {r.description} ({r.points}점{r.required ? ", 필수" : ""})
          </p>
        ))}
      </div>
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
    <main className="study-page admin-stack">
      <h1>신고 문항 관리</h1>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && draft && (
        <>
          <p>
            {data.unit
              ? `${data.unit.grade} · ${data.unit.number}. ${data.unit.name}`
              : "단원 정보 없음"}{" "}
            · {data.assessment_item.name}
          </p>
          <div className="admin-columns">
            <section className="admin-stack">
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
            <section className="admin-stack">
              <h2>신고 목록</h2>
              {data.reports.map((report) => (
                <article className="admin-report-row" key={report.id}>
                  <strong>
                    {reportKinds[report.kind]} · {reportStatuses[report.status]}
                  </strong>
                  <p className="report-description">{report.description}</p>
                  <p>{new Date(report.created_at).toLocaleString("ko-KR")}</p>
                </article>
              ))}
              <Button
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
            </section>
          </div>
          {editing && (
            <section className="admin-editor">
              <h2>직접 수정</h2>
              <label>
                문제 본문
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
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
                            i === index ? { ...c, text: e.target.value } : c,
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
                className="admin-stack admin-report-row"
                key={revision.id}
              >
                <h3>
                  {revision.source === "ai" ? "AI 수정안" : "직접 수정안"} ·{" "}
                  {revision.status === "passed"
                    ? "검사 통과"
                    : revision.status === "failed"
                      ? "검사 실패"
                      : revision.status}
                </h3>
                {revision.checks.map((check, index) => (
                  <div key={index}>
                    <p>
                      검사 {check.number}:{" "}
                      {check.issues.length ? "실패" : "통과"}
                    </p>
                    {check.issues.map((issue, i) => (
                      <p key={i}>{issue}</p>
                    ))}
                  </div>
                ))}
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
                    <Preview question={revision.payload} />
                  </div>
                </div>
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
