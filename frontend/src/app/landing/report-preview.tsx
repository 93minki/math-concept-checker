import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import ReportSummary, {
  StageIndicator,
} from "@/app/(protected)/diagnoses/[id]/report-summary";
import type { Report } from "@/lib/diagnosis-api";
import { concepts } from "./landing-content";

export function ConceptSummary() {
  return (
    <div className="comparison-concepts">
      {concepts.map(([name, level]) => (
        <div className="comparison-concept" key={name}>
          <strong>{name}</strong>
          <StageIndicator name={name} stage={level} />
        </div>
      ))}
    </div>
  );
}

export const sampleReport: Report = {
  unit_stage: "기본 이해",
  concepts: [
    {
      name: "등식의 뜻",
      stage: "깊이 이해",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [],
    },
    {
      name: "방정식과 해의 뜻",
      stage: "기본 이해",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [],
    },
    {
      name: "방정식과 항등식의 구별",
      stage: "아직 이해 못 함",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [
        "문자가 들어 있는 등식은 모두 방정식이라고 생각했을 수 있어요.",
      ],
    },
    {
      name: "등식의 성질",
      stage: "기본 이해",
      not_measured: false,
      deep_not_attempted: false,
      deep_not_measured: false,
      misconceptions: [
        "등식의 한쪽에만 같은 수를 더해도 된다고 생각했을 수 있어요.",
      ],
    },
  ],
  text: {
    not_understood:
      "방정식과 항등식을 구별하는 부분을 다시 확인해 볼 수 있어요.",
    misconception_explanations:
      "문자가 들어 있다는 것만으로 방정식이 되는 것은 아니에요.",
    next_steps:
      "여러 값으로 등식이 참이 되는지 확인하며 방정식과 항등식을 구별해 보세요.",
  },
};

export default function ReportPreview() {
  return (
    <section
      className="sample-section"
      id="sample-report"
      aria-labelledby="sample-title"
    >
      <div className="sample-intro">
        <p className="landing-kicker">SAMPLE REPORT</p>
        <h2 id="sample-title">샘플 리포트</h2>
        <p>
          실제 리포트처럼, 단원별로 개념 이해 수준과 학습 방향을 한눈에 확인해
          보세요.
        </p>
        <svg
          className="sample-illustration"
          viewBox="0 0 160 160"
          aria-hidden="true"
          fill="none"
        >
          <rect
            x="28"
            y="29"
            width="100"
            height="112"
            rx="12"
            transform="rotate(-12 28 29)"
            fill="var(--color-background-card)"
            stroke="var(--color-accent)"
            strokeWidth="2"
          />
          <path
            d="m50 54 49-10M53 65l34-7M62 112v-18m14 15V85m14 20V73"
            stroke="var(--color-accent)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="121" cy="39" r="17" fill="var(--color-accent)" />
          <path
            d="m113 39 5 5 10-11"
            stroke="var(--color-on-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <Card>
        <div className="sample-card">
          <div className="sample-card-head">
            <h3>단원 리포트</h3>
            <span>중1 · 문자의 사용과 식</span>
            <Badge label="예시" variant="neutral" />
          </div>
          <div className="sample-report-layout">
            <div className="sample-summary">
              <ReportSummary report={sampleReport} nested preview />
            </div>
            <aside className="sample-stage">
              <h4>단원 이해도</h4>
              <StageIndicator
                name="단원 요약"
                stage={sampleReport.unit_stage}
              />
            </aside>
          </div>
        </div>
      </Card>
    </section>
  );
}
