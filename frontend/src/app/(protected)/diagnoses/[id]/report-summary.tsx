import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import StageProgress from "./stage-progress";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { MathText } from "@/components/math-text";
import type { Report } from "@/lib/diagnosis-api";

type StagePresentation = {
  label: string;
  value: number;
  variant: "success" | "warning" | "error" | "neutral";
};

function stagePresentation(
  stage: string | null,
  notMeasured = false,
): StagePresentation {
  if (notMeasured || stage === null)
    return {
      label: "아직 측정하지 못했어요",
      value: 0,
      variant: "neutral",
    };
  if (stage === "깊이 이해")
    return { label: stage, value: 3, variant: "success" };
  if (stage === "기본 이해")
    return { label: stage, value: 2, variant: "warning" };
  return { label: "아직 이해 못 함", value: 1, variant: "error" };
}

export function StageIndicator({
  name,
  stage,
  notMeasured,
}: {
  name: string;
  stage: string | null;
  notMeasured?: boolean;
}) {
  const presentation = stagePresentation(stage, notMeasured);
  return (
    <VStack gap={2}>
      {/* Stage only, no numbers for students (docs/SCORING.md 5절). */}
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Badge label={presentation.label} variant={presentation.variant} />
      </HStack>
      <StageProgress
        name={name}
        label={presentation.label}
        value={presentation.value}
        variant={presentation.variant}
      />
    </VStack>
  );
}

export default function ReportSummary({
  report,
  nested = false,
  preview = false,
}: {
  report: Report;
  nested?: boolean;
  preview?: boolean;
}) {
  const descriptions: Record<string, string> = {
    "깊이 이해": "이 단원의 개념을 대부분 깊이 이해하고 있어요.",
    "기본 이해":
      "이 단원의 기본 개념은 이해하고 있어요. 아래에서 더 확인할 개념을 살펴보세요.",
    "아직 이해 못 함":
      "이 단원에서 다시 확인할 개념이 있어요. 아래 개념별 결과부터 살펴보세요.",
  };
  return (
    <VStack gap={6}>
      <VStack gap={3}>
        <Heading level={nested ? 4 : 3}>단원 이해</Heading>
        <StageIndicator name="단원" stage={report.unit_stage} />
        <Text type="supporting">
          {descriptions[report.unit_stage ?? ""] ??
            "이 단원은 아직 측정하지 못했어요."}
        </Text>
      </VStack>

      <VStack gap={4}>
        <Heading level={nested ? 4 : 3}>개념별 이해</Heading>
        <Grid columns={{ minWidth: 240, max: 2 }} gap={3}>
          {report.concepts.map((concept, index) => (
            <Card key={`${concept.name}-${index}`}>
              <VStack gap={3}>
                <Heading level={nested ? 5 : 4}>{concept.name}</Heading>
                <StageIndicator
                  name={concept.name}
                  stage={concept.stage}
                  notMeasured={concept.not_measured}
                />
                {concept.deep_not_attempted && (
                  <Text type="supporting">심화 문제는 풀지 않았어요</Text>
                )}
                {concept.deep_not_measured && (
                  <Text type="supporting">심화 문제는 아직 준비 중이에요</Text>
                )}
                {!preview && concept.misconceptions.length > 0 && (
                  <List
                    density="compact"
                    header={
                      <Heading level={nested ? 6 : 5}>
                        이렇게 생각했을 수 있어요
                      </Heading>
                    }
                  >
                    {concept.misconceptions.map((text, itemIndex) => (
                      <ListItem
                        key={`${concept.name}-${itemIndex}`}
                        label={<MathText text={text} />}
                        align="first-line"
                      />
                    ))}
                  </List>
                )}
              </VStack>
            </Card>
          ))}
        </Grid>
      </VStack>

      {report.text.next_steps && (
        <Section variant="muted">
          <VStack gap={2}>
            <Heading level={nested ? 4 : 3}>다음 학습 방향</Heading>
            {preview ? (
              <ul className="preview-next-list">
                <li>
                  방정식과 항등식의 차이를 구별하는 부분을 다시 학습해 보세요.
                </li>
                <li>등식의 성질을 다양한 문제에 먼저 적용해 보세요.</li>
                <li>
                  이해하지 못한 개념을 중심으로 짧게 복습한 뒤, 다시 진단해
                  보세요.
                </li>
              </ul>
            ) : (
              <Text as="p">
                <MathText text={report.text.next_steps} />
              </Text>
            )}
          </VStack>
        </Section>
      )}
      {!preview && report.text.not_understood && (
        <VStack gap={2}>
          <Heading level={nested ? 4 : 3}>이해하지 못한 부분</Heading>
          <Text as="p">
            <MathText text={report.text.not_understood} />
          </Text>
        </VStack>
      )}
      {!preview && report.text.misconception_explanations && (
        <VStack gap={2}>
          <Heading level={nested ? 4 : 3}>헷갈렸을 수 있는 부분</Heading>
          <Text as="p">
            <MathText text={report.text.misconception_explanations} />
          </Text>
        </VStack>
      )}
    </VStack>
  );
}
