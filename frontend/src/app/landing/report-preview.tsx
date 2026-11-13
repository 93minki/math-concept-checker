import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import ReportSummary from "@/app/(protected)/diagnoses/[id]/report-summary";
import type { Report } from "@/lib/diagnosis-api";
import { concepts } from "./landing-content";

export function ConceptSummary() {
  return (
    <VStack gap={3}>
      {concepts.map(([name, width, level, color]) => (
        <VStack gap={1} key={name}>
          <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
            <Text>{name}</Text>
            <Badge
              label={level}
              variant={
                color === "deep"
                  ? "success"
                  : color === "basic"
                    ? "warning"
                    : "error"
              }
            />
          </HStack>
          <ProgressBar
            label={`${name}: ${level}`}
            value={width}
            max={100}
            variant={
              color === "deep"
                ? "success"
                : color === "basic"
                  ? "warning"
                  : "error"
            }
            isLabelHidden
          />
        </VStack>
      ))}
    </VStack>
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
    <Section>
      <VStack gap={5}>
        <VStack gap={1}>
          <Text type="supporting">중1 · 문자의 사용과 식 · 9수02-03</Text>
          <Heading level={2}>샘플 리포트</Heading>
          <Text as="p" type="supporting">
            아래 내용은 리포트가 어떻게 보이는지 알려 주는 예시예요.
          </Text>
        </VStack>
        <ReportSummary report={sampleReport} />
      </VStack>
    </Section>
  );
}
