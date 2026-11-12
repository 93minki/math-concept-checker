import { MathText } from "@/components/math-text";
import { concepts } from "./landing-content";

export function ConceptSummary() {
  return (
    <div className="preview-concepts">
      {concepts.map(([name, width, level, color]) => (
        <div className="preview-concept" key={name}>
          <span>{name}</span>
          <strong>{level}</strong>
          <div className="preview-track">
            <div
              className={`preview-fill level-${color}`}
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
export default function ReportPreview() {
  return (
    <div className="report-preview" role="img" aria-label="리포트 예시">
      <p className="preview-subtitle">중1 · 문자의 사용과 식</p>
      <h2>이해도 리포트</h2>
      <ConceptSummary />
      <div className="preview-misconception">
        <strong>헷갈린 부분</strong>
        <p>문자가 들어 있는 등식은 모두 방정식이라고 생각했어요.</p>
        <MathText text="$2x + x = 3x$" />
      </div>
    </div>
  );
}
