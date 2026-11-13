import type { ReactNode } from "react";

export type HeaderProps = {
  unit: string;
  stage: number;
  index: number;
  total: number;
  status: ReactNode;
  error?: ReactNode;
};

export default function SolveHeader({
  unit,
  stage,
  index,
  total,
  status,
  error,
}: HeaderProps) {
  return (
    <div className="solve-header solve-compact">
      <div className="solve-heading">
        <div className="solve-title">
          <h1>{unit}</h1>
          <div className="solve-stage">
            <span>{stage}단계 ·</span>
            <h2>{stage === 1 ? "기본 문제" : "심화 문제"}</h2>
          </div>
        </div>
        <p>
          {index + 1} / {total}
        </p>
      </div>
      <div className="solve-progress">
        <div
          className="solve-bar"
          role="progressbar"
          aria-label={`전체 ${total}문제 중 ${index + 1}번째 문제`}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <span style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        {status}
      </div>
      {error}
    </div>
  );
}
