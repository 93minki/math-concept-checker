import { Button } from "@astryxdesign/core/Button";
import Mascot from "@/components/mascot";
import LandingIcon from "./landing-icons";
import { heroDescription } from "./landing-content";

function LearningMapIllustration() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art-halo" />
      <div className="laptop">
        <div className="laptop-screen">
          <div className="laptop-top">
            중1 · 8단원 <span />
          </div>
          <div className="laptop-content">
            <div className="laptop-path">
              <p>
                <b>✓</b> 1. 소인수분해
              </p>
              <p>
                <b>2</b> 2. 정수와 유리수
              </p>
              <p>
                <b>▶</b> 3. 문자의 사용과 식
              </p>
            </div>
            <div className="laptop-details">
              <strong>소인수분해</strong>
              <small>동아출판 기준</small>
              <small>진행 중</small>
              <span>이어서 풀기</span>
            </div>
          </div>
        </div>
        <div className="laptop-base" />
      </div>
      <div className="hero-mascot">
        <Mascot mood="waving" size={160} />
      </div>
      <svg
        className="hero-books"
        viewBox="0 0 120 80"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 54h92v16H12q-8-8 0-16ZM22 35h83v16H22q-8-8 0-16ZM30 17h77v15H30q-8-7 0-15Z"
          fill="var(--color-accent-muted)"
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
        <path
          d="M20 60h76M28 41h69M37 23h61"
          stroke="var(--color-accent)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}
export default function Hero() {
  return (
    <section className="hero-panel" aria-label="서비스 소개">
      <div className="hero-split">
        <div className="hero-copy">
          <p className="hero-eyebrow">
            <LandingIcon name="cap" /> 중학생을 위한 수학 개념 진단 서비스
          </p>
          <h1 aria-label="점수 말고, 개념을 확인해요">
            점수 말고,
            <br />
            <span>개념을 확인</span>해요
          </h1>
          <p className="hero-description">{heroDescription}</p>
          <div className="hero-features">
            <span>
              <LandingIcon name="check" />
              중학교 23개 단원
            </span>
            <span>
              <LandingIcon name="chart" />
              개념 3단계 리포트
            </span>
          </div>
          <div className="hero-actions">
            <Button
              label="개념 진단 시작"
              variant="primary"
              size="lg"
              href="/signup"
              icon={<LandingIcon name="play" />}
            />
            <Button
              label="샘플 리포트 보기"
              variant="secondary"
              size="lg"
              href="#sample-report"
              icon={<LandingIcon name="chart" />}
            />
          </div>
        </div>
        <LearningMapIllustration />
      </div>
    </section>
  );
}
