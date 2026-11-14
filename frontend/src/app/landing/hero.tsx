import Image from "next/image";
import { Button } from "@astryxdesign/core/Button";
import Mascot from "@/components/mascot";
import LandingIcon from "./landing-icons";
import { heroDescription } from "./landing-content";

function LearningMapIllustration() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art-halo" />
      <svg
        className="hero-sparkles"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M8 17l-3-7M17 11l1-8M25 14l6-6M30 22l7-2"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <Image
        className="hero-laptop"
        src="/images/landing/laptop-learning-map.png"
        alt=""
        width={1448}
        height={1086}
        sizes="(max-width: 800px) 92vw, 38rem"
        priority
      />
      <div className="hero-mascot">
        <Mascot mood="waving" size={160} />
      </div>
      <Image
        className="hero-books"
        src="/images/landing/books.png"
        alt=""
        width={1254}
        height={1254}
        sizes="(max-width: 800px) 34vw, 8rem"
      />
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
