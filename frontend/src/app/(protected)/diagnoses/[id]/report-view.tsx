"use client";
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
    <section className="stack">
      <h2>이해도 리포트</h2>
      {busy && <p role="status">리포트를 쓰고 있어요</p>}
      {error && (
        <Notice role="alert">
          <p>{error}</p>
          <button onClick={() => void load()}>다시 시도</button>
        </Notice>
      )}
      {report && (
        <>
          <p>단원 이해: {report.unit_stage ?? "아직 측정하지 못했어요"}</p>
          {report.concepts.map((concept, index) => (
            <article className="unit-card stack" key={index}>
              <h3>{concept.name}</h3>
              <p>
                {concept.not_measured
                  ? "아직 측정하지 못했어요"
                  : concept.stage}
              </p>
              {concept.deep_not_attempted && <p>심화 문제는 풀지 않았어요</p>}
              {concept.deep_not_measured && (
                <p>심화 문제는 아직 준비 중이에요</p>
              )}
              {concept.misconceptions.length > 0 && (
                <>
                  <h4>이렇게 생각했을 수 있어요</h4>
                  <ul>
                    {concept.misconceptions.map((text, i) => (
                      <li key={i}>
                        <MathText text={text} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
          <h3>이해하지 못한 부분</h3>
          <p>
            <MathText text={report.text.not_understood} />
          </p>
          <h3>헷갈렸을 수 있는 부분</h3>
          <p>
            <MathText text={report.text.misconception_explanations} />
          </p>
          <h3>다음 학습 방향</h3>
          <p>
            <MathText text={report.text.next_steps} />
          </p>
        </>
      )}
      <h2>문제별 결과</h2>
      {items.map((item) => (
        <article className="unit-card stack" key={item.id}>
          <h3>{item.stage === 1 ? "기본 문제" : "심화 문제"}</h3>
          <div className="problem-sheet stack">
            <ProblemText text={item.body} />
            {item.figure && <Figure figure={item.figure} />}
            {item.choices.some((choice) => choice.figure) && (
              <div className="choice-grid">
                {item.choices.map((choice) => (
                  <div className="choice" key={choice.no}>
                    <div className="choice-content">
                      <ProblemText
                        prefix={`${choice.no}. `}
                        text={choice.text}
                      />
                      {choice.figure && <Figure figure={choice.figure} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {item.answer?.selected_choice != null ? (
            <ProblemText
              prefix="내 답: "
              text={
                item.choices.find((c) => c.no === item.answer?.selected_choice)
                  ?.text ?? String(item.answer.selected_choice)
              }
            />
          ) : (
            <p>
              내 답:{" "}
              <MathText text={item.answer?.written_text || "답하지 않았어요"} />
            </p>
          )}
          {!item.result ? (
            <p>풀지 않은 문제</p>
          ) : (
            <>
              <p>{item.result.passed ? "맞았어요" : "틀렸어요"}</p>
              {item.result.correct_choice != null && (
                <p>정답: {item.result.correct_choice}번</p>
              )}
              <p>
                해설: <MathText text={item.result.explanation} />
              </p>
              {item.result.model_answer && (
                <p>
                  모범 답안: <MathText text={item.result.model_answer} />
                </p>
              )}
              {item.result.elements?.map((element, index) => (
                <div key={index}>
                  <p>
                    <MathText text={element.description} />:{" "}
                    {element.met ? "충족" : "미충족"}
                  </p>
                  <p>
                    <MathText text={element.reason} />
                  </p>
                </div>
              ))}
            </>
          )}
        </article>
      ))}
    </section>
  );
}
