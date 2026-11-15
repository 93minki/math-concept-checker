import { expect, test } from "@playwright/test";
import { renderToStaticMarkup } from "react-dom/server";
import { ManualChoices } from "../src/app/(protected)/admin/reports/[questionId]/view";
import type { AdminQuestion } from "../src/lib/reports-api";

const question: AdminQuestion = {
  assessment_item_id: "a",
  difficulty: "normal",
  variant: 1,
  question_type: "multiple_choice",
  body: "문제",
  explanation: "해설",
  figure: null,
  model_answer: null,
  hard_condition: null,
  hard_condition_reason: null,
  choices: [
    {
      no: 1,
      text: "첫 보기",
      is_correct: true,
      misconception_id: null,
      figure: null,
    },
    {
      no: 2,
      text: "둘째 보기",
      is_correct: false,
      misconception_id: null,
      figure: null,
    },
  ],
  rubric: [],
};
test("직접 수정 정답 라디오를 방향키로 고른다", async ({ page }) => {
  const markup = renderToStaticMarkup(
    <ManualChoices draft={question} onChange={() => {}} />,
  );
  await page.setContent(markup);
  const first = page.getByRole("radio", { name: "보기 1 정답" });
  const second = page.getByRole("radio", { name: "보기 2 정답" });
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(second).toBeChecked();
  await expect(first).not.toBeChecked();
});
