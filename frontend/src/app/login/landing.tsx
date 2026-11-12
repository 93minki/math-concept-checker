import ReportPreview, { ConceptSummary } from "./report-preview";
import { heroDescription, heroTitle, reasons, steps } from "./landing-content";

export default function Landing() {
  return (
    <main className="landing">
      <div className="intro-hero">
        <div className="landing-hero-copy">
          <h1>{heroTitle}</h1>
          <p>{heroDescription}</p>
        </div>
        <ReportPreview />
      </div>
      <section className="landing-section">
        <h2>같은 시험, 다르게 보기</h2>
        <div className="landing-comparison">
          <div>
            <h3>점수로 보면</h3>
            <strong className="score">70점</strong>
            <p>어디서 막혔는지는 알 수 없어요</p>
          </div>
          <div>
            <h3>개념으로 보면</h3>
            <ConceptSummary />
          </div>
        </div>
      </section>
      <section className="landing-section">
        <h2>왜 개념을 확인해야 할까요?</h2>
        <ol className="landing-reasons">
          {reasons.map(([title, description], index) => (
            <li key={title}>
              <span className="landing-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="landing-section">
        <h2>이렇게 진단해요</h2>
        <ol className="landing-steps">
          {steps.map(([title, description], index) => (
            <li key={title}>
              <span className="landing-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
