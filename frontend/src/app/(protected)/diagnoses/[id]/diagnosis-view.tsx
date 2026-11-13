"use client";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProblemText } from "@/components/problem-text";
import { Figure } from "@/components/figure";
import {
  ApiError,
  authRedirect,
  getDiagnosis,
  saveAnswer,
  submitStage,
  type AnswerInput,
  type Diagnosis,
  type Item,
} from "@/lib/diagnosis-api";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import Notice from "./notice";
import ReportView from "./report-view";
import SolveHeader from "./solve-header";
import { ChoiceNumber } from "@/components/choice-number";

type SaveState = "idle" | "saving" | "saved" | "error";
const initialAnswer = (item: Item): AnswerInput =>
  item.question_type === "multiple_choice"
    ? { selected_choice: item.answer?.selected_choice ?? 0 }
    : { written_text: item.answer?.written_text ?? "" };
const answered = (answer: AnswerInput) =>
  "selected_choice" in answer
    ? answer.selected_choice > 0
    : answer.written_text.trim().length > 0;
const saveStatusLabel = (state: SaveState | undefined) => {
  if (state === "saving") return "저장 중…";
  if (state === "saved") return "저장됨";
  return "";
};

export default function DiagnosisView({ id }: { id: string }) {
  const router = useRouter();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerInput>>({});
  const latest = useRef<Record<number, AnswerInput>>({});
  const saved = useRef<Record<number, string>>({});
  const queues = useRef<Record<number, Promise<boolean>>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const token = useRef<string | null>(null);
  const [index, setIndex] = useState(0);
  const [states, setStates] = useState<Record<number, SaveState>>({});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [stageNotice, setStageNotice] = useState(false);
  const readonly =
    !!diagnosis &&
    diagnosis.status !== "stage1" &&
    diagnosis.status !== "stage2";
  const stage = diagnosis?.status === "stage2" ? 2 : 1;
  const stageItems =
    diagnosis?.items.filter((item) => item.stage === stage) ?? [];
  const finished =
    !!diagnosis &&
    (diagnosis.status === "completed" ||
      (diagnosis.status === "aborted" &&
        diagnosis.stage1_submitted_at !== null));
  const applyDiagnosis = useCallback((data: Diagnosis) => {
    const values = Object.fromEntries(
      data.items.map((item) => [item.id, initialAnswer(item)]),
    );
    latest.current = values;
    saved.current = Object.fromEntries(
      data.items.map((item) => [item.id, JSON.stringify(values[item.id])]),
    );
    setAnswers(values);
    setDiagnosis(data);
    setStates({});
    writable.current = data.status === "stage1" || data.status === "stage2";
    const activeItems = data.items.filter(
      (item) => item.stage === (data.status === "stage2" ? 2 : 1),
    );
    const first = activeItems.findIndex((item) => !answered(values[item.id]));
    setIndex(first < 0 ? 0 : first);
  }, []);
  const writable = useRef(false);
  useEffect(() => {
    let active = true;
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        token.current = data.session?.access_token ?? null;
      });
    getDiagnosis(id)
      .then((data) => {
        if (!active) return;
        applyDiagnosis(data);
      })
      .catch((e) => {
        if (active && !authRedirect(e, router.push))
          setError(
            e instanceof ApiError && e.status === 404
              ? "진단을 찾을 수 없어요"
              : "진단을 불러오지 못했어요. 새로고침해 주세요.",
          );
      });
    return () => {
      active = false;
    };
  }, [id, router, applyDiagnosis]);
  const save = useCallback(
    (itemId: number): Promise<boolean> => {
      clearTimeout(timers.current[itemId]);
      const input = latest.current[itemId];
      if (!input || ("selected_choice" in input && !input.selected_choice))
        return Promise.resolve(true);
      const serialized = JSON.stringify(input);
      if (saved.current[itemId] === serialized && !queues.current[itemId])
        return Promise.resolve(true);
      setStates((prev) => ({ ...prev, [itemId]: "saving" }));
      const previous = queues.current[itemId] ?? Promise.resolve(true);
      const task = previous
        .catch(() => false)
        .then(async () => {
          try {
            await saveAnswer(id, itemId, input);
            saved.current[itemId] = serialized;
            if (JSON.stringify(latest.current[itemId]) === serialized)
              setStates((prev) => ({ ...prev, [itemId]: "saved" }));
            return true;
          } catch (e) {
            if (!authRedirect(e, router.push))
              setStates((prev) => ({ ...prev, [itemId]: "error" }));
            return false;
          }
        });
      queues.current[itemId] = task;
      void task.then(() => {
        if (queues.current[itemId] === task) delete queues.current[itemId];
      });
      return task;
    },
    [id, router],
  );
  useEffect(() => {
    const currentTimers = timers.current;
    const flush = () => {
      if (!writable.current || !token.current) return;
      for (const [key, input] of Object.entries(latest.current)) {
        if (
          saved.current[Number(key)] === JSON.stringify(input) ||
          ("selected_choice" in input && !input.selected_choice)
        )
          continue;
        void fetch(
          `${publicEnv.NEXT_PUBLIC_API_BASE_URL}/diagnoses/${encodeURIComponent(id)}/items/${key}/answer`,
          {
            method: "PUT",
            keepalive: true,
            headers: {
              Authorization: `Bearer ${token.current}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
          },
        ).catch(() => {});
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      Object.values(currentTimers).forEach(clearTimeout);
    };
  }, [id]);
  const closeConfirm = useCallback(() => {
    setConfirm(false);
    queueMicrotask(() => submitButtonRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!confirm) return;
    const timer = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [confirm]);
  function update(item: Item, input: AnswerInput) {
    latest.current = { ...latest.current, [item.id]: input };
    setAnswers(latest.current);
    if (item.question_type === "multiple_choice") void save(item.id);
    else {
      clearTimeout(timers.current[item.id]);
      setStates((prev) => ({ ...prev, [item.id]: "idle" }));
      timers.current[item.id] = setTimeout(() => void save(item.id), 1000);
    }
  }
  async function move(next: number) {
    if (!diagnosis) return;
    const current = stageItems[index];
    if (!readonly && current) await save(current.id);
    setIndex(next);
  }
  async function submit() {
    if (!diagnosis) return;
    setBusy(true);
    setError("");
    setStageNotice(false);
    try {
      const results = await Promise.all(
        stageItems.map((item) => save(item.id)),
      );
      if (results.some((result) => !result)) {
        setError("답안을 저장하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      const result = await submitStage(id, stage);
      setConfirm(false);
      const updated = await getDiagnosis(id);
      applyDiagnosis(updated);
      if (result.status === "stage2") setStageNotice(true);
    } catch (e) {
      setConfirm(false);
      if (authRedirect(e, router.push)) return;
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.detail &&
        typeof e.detail === "object" &&
        "code" in e.detail &&
        e.detail.code === "answers_changed"
      ) {
        try {
          applyDiagnosis(await getDiagnosis(id));
          setError("답이 바뀌었어요. 다시 제출해 주세요");
        } catch (reloadError) {
          if (!authRedirect(reloadError, router.push))
            setError("답을 다시 불러오지 못했어요. 새로고침해 주세요.");
        }
      } else if (e instanceof ApiError && e.status === 503)
        setError("채점을 하지 못했어요. 잠시 후 다시 제출해 주세요");
      else setError("제출하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  const item = stageItems[index];
  const answer = item ? answers[item.id] : undefined;
  const canSubmit =
    stageItems.length > 0 &&
    stageItems.every(
      (value) => answers[value.id] && answered(answers[value.id]),
    ) &&
    !readonly;
  const isLast = index === stageItems.length - 1;
  const currentAnswered = !!(answer && answered(answer));
  const navigationHint =
    !currentAnswered && item
      ? isLast
        ? item.question_type === "written"
          ? "답을 쓰면 제출할 수 있어요"
          : "답을 고르면 제출할 수 있어요"
        : item.question_type === "written"
          ? "답을 쓰면 다음 문제로 넘어갈 수 있어요"
          : "답을 고르면 다음 문제로 넘어갈 수 있어요"
      : null;
  return (
    <VStack gap={4}>
      <Link href="/" isStandalone hasUnderline>
        ← 단원 선택으로
      </Link>
      {error && <Notice role="alert">{error}</Notice>}
      {!diagnosis && !error && <Text as="p">진단을 불러오고 있어요.</Text>}
      {diagnosis && (
        <>
          {readonly && <Heading level={1}>{diagnosis.unit.name}</Heading>}
          {diagnosis.status === "aborted" && (
            <Notice>
              {diagnosis.abort_reason === "expired"
                ? "기간이 지나 중단된 진단이에요"
                : "새로 시작해서 중단된 진단이에요"}
            </Notice>
          )}
          {finished && <ReportView diagnosis={diagnosis} />}
          {stageNotice && !readonly && (
            <Notice>
              기본 문제를 잘 풀었어요. 심화 문제 {stageItems.length}개를 풀어
              볼까요?
            </Notice>
          )}
          {busy && <Notice>채점하고 있어요</Notice>}
          {!readonly && item && answer && (
            <VStack as="section" gap={5}>
              <SolveHeader
                {...{
                  unit: diagnosis.unit.name,
                  stage,
                  index,
                  total: stageItems.length,
                  status: (
                    <HStack
                      as="span"
                      className="diagnosis-save-status"
                      gap={0}
                      role="status"
                      aria-label="답안 저장 상태"
                      aria-live="polite"
                    >
                      <Text as="span" type="supporting">
                        {saveStatusLabel(states[item.id])}
                      </Text>
                      {states[item.id] === "saved" && (
                        <Text as="span" type="supporting" aria-hidden="true">
                          {" "}
                          ✓
                        </Text>
                      )}
                    </HStack>
                  ),
                  error: states[item.id] === "error" && (
                    <Banner
                      status="error"
                      title="저장하지 못했어요"
                      role="alert"
                      collapsible={false}
                    >
                      <Button
                        label="다시 시도"
                        variant="secondary"
                        isDisabled={busy}
                        onClick={() => void save(item.id)}
                      />
                    </Banner>
                  ),
                }}
              />
              <div className="problem-sheet stack">
                <div className="question">
                  <ProblemText text={item.body} />
                  {item.figure && <Figure figure={item.figure} />}
                </div>
                {item.question_type === "multiple_choice" && (
                  <div className="choice-area">
                    <fieldset
                      className={
                        item.choices.some((choice) => choice.figure)
                          ? "choice-grid"
                          : "stack"
                      }
                      disabled={readonly || busy}
                    >
                      <legend className="visually-hidden">답을 골라요</legend>
                      {item.choices.map((choice) => (
                        <label key={choice.no} className="choice">
                          <input
                            type="radio"
                            name={`item-${item.id}`}
                            checked={
                              "selected_choice" in answer &&
                              answer.selected_choice === choice.no
                            }
                            onChange={() =>
                              update(item, { selected_choice: choice.no })
                            }
                          />
                          <ChoiceNumber number={choice.no} />
                          <div className="choice-content">
                            <ProblemText text={choice.text} />
                            {choice.figure && <Figure figure={choice.figure} />}
                          </div>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                )}
              </div>
              {item.question_type === "written" && "written_text" in answer && (
                <VStack gap={2}>
                  <label htmlFor="answer">풀이와 답</label>
                  <textarea
                    id="answer"
                    maxLength={1000}
                    value={answer.written_text}
                    disabled={readonly || busy}
                    onChange={(e) =>
                      update(item, { written_text: e.target.value })
                    }
                  />
                  <Text as="p" type="supporting" hasTabularNumbers>
                    {answer.written_text.length} / 1000자
                  </Text>
                </VStack>
              )}
              <HStack className="diagnosis-actions" gap={3}>
                <Button
                  label="이전"
                  variant="secondary"
                  width="100%"
                  size="lg"
                  isDisabled={index === 0 || busy}
                  onClick={() => void move(index - 1)}
                />
                {isLast ? (
                  <Button
                    label="제출하기"
                    variant="primary"
                    width="100%"
                    size="lg"
                    ref={submitButtonRef}
                    isDisabled={!canSubmit || busy}
                    onClick={() => setConfirm(true)}
                  />
                ) : (
                  <Button
                    label="다음"
                    variant="primary"
                    width="100%"
                    size="lg"
                    isDisabled={!currentAnswered || busy}
                    onClick={() => void move(index + 1)}
                  />
                )}
              </HStack>
              {navigationHint && (
                <Text as="p" type="supporting" justify="end">
                  {navigationHint}
                </Text>
              )}
            </VStack>
          )}
          {!readonly && (
            <Dialog
              isOpen={confirm}
              onOpenChange={(isOpen) => {
                if (!isOpen) closeConfirm();
              }}
              purpose="info"
            >
              <Layout
                header={<DialogHeader title="제출 확인" />}
                content={
                  <LayoutContent>
                    <Text as="p">
                      답안을 제출할까요? 제출하면 답을 고칠 수 없어요.
                    </Text>
                  </LayoutContent>
                }
                footer={
                  <LayoutFooter>
                    <HStack gap={2} hAlign="end" wrap="wrap">
                      <Button
                        label="제출할게요"
                        variant="primary"
                        type="button"
                        ref={confirmButtonRef}
                        data-autofocus
                        isDisabled={busy}
                        isLoading={busy}
                        onClick={() => void submit()}
                      />
                      <Button
                        label="계속 풀기"
                        variant="secondary"
                        type="button"
                        isDisabled={busy}
                        onClick={closeConfirm}
                      />
                    </HStack>
                  </LayoutFooter>
                }
              />
            </Dialog>
          )}
        </>
      )}
    </VStack>
  );
}
