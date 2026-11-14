import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import Mascot from "@/components/mascot";
import Hero from "./hero";
import LandingIcon from "./landing-icons";
import ReportPreview, { ConceptSummary } from "./report-preview";
import { reasons, steps } from "./landing-content";
import "./landing.css";

export default function Landing() {
  return (
    <main className="landing">
      <Hero />
      <section
        className="comparison-section"
        aria-labelledby="comparison-heading"
      >
        <p className="landing-kicker">SCORE vs CONCEPT</p>
        <h2 id="comparison-heading">
          같은 시험, <span>다르게 보기</span>
        </h2>
        <p>
          단순한 점수가 아닌, 개념별 이해 정도로 진짜 실력을 확인할 수 있어요.
        </p>
        <div className="comparison-grid">
          <Card>
            <div className="score-card">
              <h3>점수로 보면</h3>
              <strong className="score-number">70점</strong>
              <div className="score-grid">
                {Array.from({ length: 10 }, (_, index) => (
                  <div key={index}>
                    <small>{index + 1}번</small>
                    <strong
                      className={index < 7 ? "score-right" : "score-wrong"}
                    >
                      {index < 7 ? "✓ 맞음" : "✗ 틀림"}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="score-note">
                몇 번을 틀렸는지는 알 수 있지만,
                <br />
                어떤 개념에서 약한지는 알 수 없어요.
              </p>
            </div>
          </Card>
          <Card className="comparison-highlight">
            <div className="concept-card">
              <h3>개념으로 보면</h3>
              <ConceptSummary />
            </div>
          </Card>
        </div>
      </section>
      <ReportPreview />
      <section className="process-section" aria-labelledby="process-heading">
        <p className="landing-kicker">PROCESS</p>
        <h2 id="process-heading">이렇게 진단해요</h2>
        <p>간단한 4단계로, 내 개념 이해도를 확인할 수 있어요.</p>
        <div className="process-grid">
          {steps.map(([title, description], index) => (
            <article className="process-item" key={title}>
              <span className="landing-icon-tile">
                <LandingIcon
                  name={(["book", "pencil", "trophy", "chart"] as const)[index]}
                />
              </span>
              <div>
                <h3>
                  {index + 1}. {title}
                </h3>
                <p>{description}</p>
              </div>
              {index < steps.length - 1 && (
                <span className="process-arrow" aria-hidden="true">
                  ›
                </span>
              )}
            </article>
          ))}
        </div>
      </section>
      <section className="benefit-section" aria-labelledby="benefit-heading">
        <p className="landing-kicker">BENEFIT</p>
        <h2 id="benefit-heading">왜 개념을 확인해야 할까요?</h2>
        <p>수학 실력을 제대로 키우려면, 점수가 아닌 개념의 이해가 중요해요.</p>
        <div className="benefit-grid">
          {reasons.map(([title, description], index) => (
            <Card key={title}>
              <div className="benefit-card">
                <span className="landing-icon-tile">
                  <LandingIcon
                    name={(["target", "search", "growth"] as const)[index]}
                  />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
      <section className="landing-cta" aria-labelledby="cta-heading">
        <div>
          <h2 id="cta-heading">
            이제 점수 말고
            <br />
            개념을 확인해보세요.
          </h2>
          <p>
            내가 어떤 개념을 알고, 무엇을 더 공부해야 하는지 바로 알 수 있어요.
          </p>
        </div>
        <Button
          label="지금 시작하기"
          variant="secondary"
          size="lg"
          href="/signup"
          icon={<LandingIcon name="play" />}
        />
        <Mascot mood="waving" size={155} />
      </section>
    </main>
  );
}
