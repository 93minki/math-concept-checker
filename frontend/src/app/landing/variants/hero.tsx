"use client";

import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useState, useSyncExternalStore } from "react";
import { StageIndicator } from "@/app/(protected)/diagnoses/[id]/report-summary";
import Mascot from "@/components/mascot";
import { heroDescription, heroTitle } from "../landing-content";
import "./hero.css";

function variantSnapshot() {
  return new URLSearchParams(window.location.search).get("__variant") === "b"
    ? "b"
    : "a";
}
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}
function chooseVariant(variant: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("__variant", variant);
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function MiniReport() {
  return (
    <Card>
      <VStack gap={3}>
        <Text weight="bold">개념별 이해</Text>
        <VStack gap={1}>
          <Text>등식의 뜻</Text>
          <StageIndicator name="등식의 뜻 예시" stage="깊이 이해" />
        </VStack>
        <VStack gap={1}>
          <Text>방정식의 뜻</Text>
          <StageIndicator name="방정식의 뜻 예시" stage="기본 이해" />
        </VStack>
      </VStack>
    </Card>
  );
}
function VariantPicker({ variant }: { variant: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (
        event.key.toLowerCase() === "h" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        setHidden((value) => !value);
      } else if (
        !hidden &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        !target?.closest(".hero-carousel")
      ) {
        event.preventDefault();
        chooseVariant(event.key === "ArrowLeft" ? "a" : "b");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden]);
  if (hidden) return null;
  return (
    <aside className="variant-picker" aria-label="시안 선택">
      <strong>히어로 시안</strong>
      <button
        type="button"
        aria-pressed={variant === "a"}
        onClick={() => chooseVariant("a")}
      >
        A 나눈 히어로
      </button>
      <button
        type="button"
        aria-pressed={variant === "b"}
        onClick={() => chooseVariant("b")}
      >
        B 넘겨 보는 히어로
      </button>
      <small>← → 전환 · H 숨기기</small>
    </aside>
  );
}
function Carousel() {
  const [slide, setSlide] = useState(0);
  const titles = [
    heroTitle,
    "개념마다 어디까지 이해했는지",
    "기본 → 심화 → 리포트",
  ];
  return (
    <VStack
      className="hero-carousel"
      gap={4}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
          setSlide(
            (current) => (current + (event.key === "ArrowRight" ? 1 : 2)) % 3,
          );
        }
      }}
    >
      <div className="hero-slide">
        <VStack gap={3}>
          <Heading level={1} type="display-2">
            {titles[slide]}
          </Heading>
          <Text as="p" type="large">
            {heroDescription}
          </Text>
        </VStack>
        <div className="hero-visual">
          {slide === 0 ? (
            <Mascot mood="waving" size={200} />
          ) : slide === 1 ? (
            <MiniReport />
          ) : (
            <HStack gap={3} wrap="wrap">
              <Text type="large">① 기본</Text>
              <Text type="large">② 심화</Text>
              <Text type="large">③ 리포트</Text>
            </HStack>
          )}
        </div>
      </div>
      <HStack gap={2} vAlign="center" hAlign="center">
        <Button
          label="이전 슬라이드"
          onClick={() => setSlide((slide + 2) % 3)}
        />
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            type="button"
            className="hero-dot"
            aria-label={`${index + 1}번 슬라이드`}
            aria-current={slide === index ? "true" : undefined}
            onClick={() => setSlide(index)}
          />
        ))}
        <Button
          label="다음 슬라이드"
          onClick={() => setSlide((slide + 1) % 3)}
        />
      </HStack>
    </VStack>
  );
}
export default function Hero() {
  const variant = useSyncExternalStore(subscribe, variantSnapshot, () => "a");
  return (
    <>
      <section className="hero-panel" aria-label="서비스 소개">
        {variant === "a" ? (
          <div className="hero-slide">
            <VStack gap={3}>
              <Heading level={1} type="display-2">
                {heroTitle}
              </Heading>
              <Text as="p" type="large">
                {heroDescription}
              </Text>
              <Text type="supporting">
                중학교 23개 단원 · 개념별 3단계 리포트
              </Text>
            </VStack>
            <div className="hero-visual hero-split-visual">
              <Mascot mood="waving" size={200} />
              <MiniReport />
            </div>
          </div>
        ) : (
          <Carousel />
        )}
      </section>
      <VariantPicker variant={variant} />
    </>
  );
}
