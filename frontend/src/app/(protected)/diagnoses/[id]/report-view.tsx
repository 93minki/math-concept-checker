"use client";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MathText } from "@/components/math-text";
import { ProblemText } from "@/components/problem-text";
import { Figure } from "@/components/figure";
import {
  ApiError,
  authRedirect,
  getDiagnosis,
  getReport,
  type Diagnosis,
  type Report,
} from "@/lib/diagnosis-api";
import Notice from "./notice";
import StatusScreen from "@/components/status-screen";
import { ChoiceNumber } from "@/components/choice-number";
import ReportSummary from "./report-summary";

export default function ReportView({ diagnosis }: { diagnosis: Diagnosis }) {
  const router = useRouter();
  const [items, setItems] = useState(diagnosis.items);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await getReport(diagnosis.id);
      if (diagnosis.status === "aborted")
        setItems((await getDiagnosis(diagnosis.id)).items);
      setReport(result);
    } catch (e) {
      if (!authRedirect(e, router.push))
        setError(
          e instanceof ApiError && e.status === 409
            ? "답이 바뀌었어요. 다시 시도해 주세요."
            : "리포트를 불러오지 못했어요. 다시 시도해 주세요.",
        );
    } finally {
      setBusy(false);
    }
  }, [diagnosis.id, diagnosis.status, router]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  return (
    <VStack as="section" gap={8}>
      <Heading level={2}>이해도 리포트</Heading>
      {busy && (
        <StatusScreen
          mood="thinking"
          title="리포트를 쓰고 있어요"
          description="풀이를 살펴보고 있어요. 잠시만 기다려 주세요."
          live
          compact
        />
      )}
      {error && (
        <Notice role="alert">
          <VStack gap={2}>
            <Text as="p">{error}</Text>
            <Button
              label="다시 시도"
              variant="primary"
              onClick={() => void load()}
            />
          </VStack>
        </Notice>
      )}
      {report && <ReportSummary report={report} />}
      <Heading level={2}>문제별 결과</Heading>
      <VStack gap={4}>
        {items.map((item, index) => (
          <Card key={item.id}>
            <VStack gap={4}>
              <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
                <Heading level={3}>
                  {items
                    .slice(0, index)
                    .filter((previous) => previous.stage === item.stage)
                    .length + 1}
                  번 · {item.stage === 1 ? "기본 문제" : "심화 문제"}
                </Heading>
                {item.result ? (
                  <Badge
                    label={item.result.passed ? "맞았어요" : "틀렸어요"}
                    variant={item.result.passed ? "success" : "error"}
                  />
                ) : (
                  <Badge label="풀지 않은 문제" variant="neutral" />
                )}
              </HStack>
              <div className="problem-sheet stack">
                <div className="question">
                  <ProblemText text={item.body} />
                  {item.figure && <Figure figure={item.figure} />}
                </div>
                {item.question_type === "multiple_choice" && (
                  <div
                    className={`choice-area ${item.choices.some((choice) => choice.figure) ? "choice-grid" : "stack"}`}
                  >
                    {item.choices.map((choice) => {
                      const selected =
                        item.answer?.selected_choice === choice.no;
                      const correct = item.result?.correct_choice === choice.no;
                      const wrong =
                        selected &&
                        item.result?.correct_choice != null &&
                        !correct;
                      return (
                        <div
                          className={`choice report-choice${correct ? " report-choice-correct" : wrong ? " report-choice-wrong" : ""}`}
                          key={choice.no}
                        >
                          <ChoiceNumber number={choice.no} />
                          <div className="choice-content">
                            <ProblemText text={choice.text} />
                            {choice.figure && <Figure figure={choice.figure} />}
                          </div>
                          {correct && selected ? (
                            <span className="visually-hidden">
                              내 답 · 정답
                            </span>
                          ) : correct ? (
                            <span className="report-choice-label">✓ 정답</span>
                          ) : wrong ? (
                            <span className="report-choice-label">✗ 내 답</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {item.question_type !== "multiple_choice" && (
                <VStack gap={2}>
                  <Text type="label">내 답</Text>
                  <Text as="p">
                    <MathText
                      text={item.answer?.written_text || "답하지 않았어요"}
                    />
                  </Text>
                </VStack>
              )}
              {item.result && (
                <>
                  <VStack gap={2}>
                    <Text type="label">해설</Text>
                    <Text as="p">
                      <MathText text={item.result.explanation} />
                    </Text>
                  </VStack>
                  {item.result.model_answer && (
                    <VStack gap={2}>
                      <Text type="label">모범 답안</Text>
                      <Text as="p">
                        <MathText text={item.result.model_answer} />
                      </Text>
                    </VStack>
                  )}
                  {item.result.elements && item.result.elements.length > 0 && (
                    <List
                      hasDividers
                      header={<Heading level={4}>채점 요소</Heading>}
                    >
                      {item.result.elements.map((element, index) => (
                        <ListItem
                          key={index}
                          label={<MathText text={element.description} />}
                          description={<MathText text={element.reason} />}
                          endContent={
                            <Badge
                              label={element.met ? "충족" : "미충족"}
                              variant={element.met ? "success" : "error"}
                            />
                          }
                          align="first-line"
                        />
                      ))}
                    </List>
                  )}
                </>
              )}
            </VStack>
          </Card>
        ))}
      </VStack>
    </VStack>
  );
}
