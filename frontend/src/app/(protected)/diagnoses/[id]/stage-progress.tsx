"use client";

import { ProgressBar } from "@astryxdesign/core/ProgressBar";

export default function StageProgress({
  name,
  label,
  value,
  variant,
}: {
  name: string;
  label: string;
  value: number;
  variant: "success" | "warning" | "error" | "neutral";
}) {
  return (
    <ProgressBar
      label={`${name} 이해 단계: ${label}`}
      value={value}
      max={3}
      formatValueLabel={() => label}
      variant={variant}
      isLabelHidden
    />
  );
}
