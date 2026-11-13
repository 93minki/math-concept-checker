"use client";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Section } from "@astryxdesign/core/Section";
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
        {items.map((item) => (
          <Card key={item.id}>
            <VStack gap={4}>
              <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
                <Heading level={3}>
                  {item.stage === 1 ? "기본 문제" : "심화 문제"}
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
                    {item.choices.map((choice) => (
                      <div className="choice report-choice" key={choice.no}>
                        <ChoiceNumber number={choice.no} />
                        <div className="choice-content">
                          <ProblemText text={choice.text} />
                          {choice.figure && <Figure figure={choice.figure} />}
                          <div className="choice-tags">
                            {item.answer?.selected_choice === choice.no && (
                              <span>내 답</span>
                            )}
                            {item.result?.correct_choice === choice.no && (
                              <span>정답</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {item.answer?.selected_choice != null ? (
                <div>
                  <div className="answer-choice">
                    <span>내 답:</span>
                    <ChoiceNumber number={item.answer.selected_choice} />
                    <ProblemText
                      text={
                        item.choices.find(
                          (c) => c.no === item.answer?.selected_choice,
                        )?.text ?? ""
                      }
                    />
                  </div>
                  {item.choices
                    .filter(
                      (c) => c.no === item.answer?.selected_choice && c.figure,
                    )
                    .map(
                      (c) =>
                        c.figure && (
                          <div className="problem-sheet" key={c.no}>
                            <Figure figure={c.figure} />
                          </div>
                        ),
                    )}
                </div>
              ) : (
                <p>
                  내 답:{" "}
                  <MathText
                    text={item.answer?.written_text || "답하지 않았어요"}
                  />
                </p>
              )}
              {item.result && (
                <>
                  {item.result.correct_choice != null && (
                    <div>
                      <div className="answer-choice">
                        <span>정답:</span>
                        <ChoiceNumber number={item.result.correct_choice} />
                        <ProblemText
                          text={
                            item.choices.find(
                              (c) => c.no === item.result?.correct_choice,
                            )?.text ?? ""
                          }
                        />
                      </div>
                      {item.choices
                        .filter(
                          (c) =>
                            c.no === item.result?.correct_choice && c.figure,
                        )
                        .map(
                          (c) =>
                            c.figure && (
                              <div className="problem-sheet" key={c.no}>
                                <Figure figure={c.figure} />
                              </div>
                            ),
                        )}
                    </div>
                  )}
                  <Section variant="muted">
                    <VStack gap={2}>
                      <Heading level={4}>해설</Heading>
                      <Text as="p">
                        <MathText text={item.result.explanation} />
                      </Text>
                    </VStack>
                  </Section>
                  {item.result.model_answer && (
                    <Section>
                      <VStack gap={2}>
                        <Heading level={4}>모범 답안</Heading>
                        <Text as="p">
                          <MathText text={item.result.model_answer} />
                        </Text>
                      </VStack>
                    </Section>
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
