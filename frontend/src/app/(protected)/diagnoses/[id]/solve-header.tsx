import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
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
    <VStack className="diagnosis-header" gap={2}>
      <Card>
        <VStack gap={2}>
          <HStack
            className="diagnosis-heading"
            gap={3}
            hAlign="between"
            vAlign="start"
          >
            <VStack gap={1}>
              <Heading
                className="diagnosis-unit-title"
                level={1}
                color="secondary"
              >
                {unit}
              </Heading>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Badge label={`${stage}단계 ·`} variant="info" />
                <Heading level={2}>
                  {stage === 1 ? "기본 문제" : "심화 문제"}
                </Heading>
              </HStack>
            </VStack>
            <Text as="p" type="label" hasTabularNumbers textWrap="nowrap">
              {index + 1} / {total}
            </Text>
          </HStack>
          <HStack className="diagnosis-progress" gap={2} vAlign="center">
            <ProgressBar
              label={`전체 ${total}문제 중 ${index + 1}번째 문제`}
              value={index + 1}
              max={total}
              isLabelHidden
            />
            {status}
          </HStack>
        </VStack>
      </Card>
      {error}
    </VStack>
  );
}
