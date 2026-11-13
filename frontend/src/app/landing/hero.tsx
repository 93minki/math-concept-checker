import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { StageIndicator } from "@/app/(protected)/diagnoses/[id]/report-summary";
import Mascot from "@/components/mascot";
import { heroDescription, heroTitle } from "./landing-content";

// Split hero: copy on the left, mascot and a mini report on the right
// (user chose variant A, 2026-11-13).
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

export default function Hero() {
  return (
    <section className="hero-panel" aria-label="서비스 소개">
      <div className="hero-split">
        <VStack gap={3}>
          <Heading level={1} type="display-2">
            {heroTitle}
          </Heading>
          <Text as="p" type="large">
            {heroDescription}
          </Text>
          <Text type="supporting">중학교 23개 단원 · 개념별 3단계 리포트</Text>
        </VStack>
        <div className="hero-visual">
          <Mascot mood="waving" size={200} />
          <MiniReport />
        </div>
      </div>
    </section>
  );
}
