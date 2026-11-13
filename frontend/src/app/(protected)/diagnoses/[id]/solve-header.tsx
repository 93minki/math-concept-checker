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
        <VStack gap={3}>
          <HStack
            className="diagnosis-heading"
            gap={3}
            hAlign="between"
            vAlign="center"
          >
            {/* The unit leads; the stage is a small tag (user 2026-11-13). */}
            <Heading className="diagnosis-unit-title" level={1}>
              {unit}
            </Heading>
            <Text as="p" type="label" hasTabularNumbers textWrap="nowrap">
              {index + 1} / {total}
            </Text>
          </HStack>
          <div className="diagnosis-stage">
            <span aria-hidden="true">{stage}단계 · </span>
            <Heading level={2} display="inline" color="inherit">
              {stage === 1 ? "기본 문제" : "심화 문제"}
            </Heading>
          </div>
          {/* The status sits in a fixed slot so it never moves the page. */}
          <div className="diagnosis-progress">
            <ProgressBar
              label={`전체 ${total}문제 중 ${index + 1}번째 문제`}
              value={index + 1}
              max={total}
              isLabelHidden
            />
            <div className="diagnosis-save-slot">{status}</div>
          </div>
        </VStack>
      </Card>
      {error}
    </VStack>
  );
}
