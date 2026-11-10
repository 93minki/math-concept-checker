import argparse
import json
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Literal, cast

from pydantic import BaseModel

from app.ai.providers.base import StructuredResult
from app.ai.providers.gemini import GeminiProvider
from app.ai.providers.openai import OpenAIProvider
from app.ai.schemas import (
    Grading,
    Question,
    ReportInput,
    ReportText,
    Review,
    load_concept,
)
from app.ai.tasks import (
    BudgetExceeded,
    CallHooks,
    GenerationOutcome,
    GradedAnswer,
    generate_question,
    grade_written,
    write_report,
)
from app.settings import get_settings

ROOT = Path(__file__).resolve().parents[3]
EVAL_FILE = (
    Path(__file__).resolve().parents[2] / "data" / "eval" / "grading_9수02-03.json"
)
PROVIDER_MODELS = {"gemini": "gemini-3.8-flash", "openai": "gpt-6.1-terra"}


class AnswerCase(BaseModel):
    id: str
    text: str
    expected: dict[str, bool]
    expected_misconceptions: list[str]


class ReportCase(ReportInput):
    id: str


class EvalFixture(BaseModel):
    question: Question
    answers: list[AnswerCase]
    report_inputs: list[ReportCase]


def load_fixture() -> EvalFixture:
    raw = cast(dict[str, object], json.loads(EVAL_FILE.read_text(encoding="utf-8")))
    question = cast(dict[str, object], raw["question"])
    question.setdefault("explanation", "")
    question.setdefault("choices", [])
    for report in cast(list[dict[str, object]], raw["report_inputs"]):
        score = float(str(report["unit_score"]))
        report["unit_stage"] = (
            "아직 이해 못 함"
            if score < 0.5
            else "기본 이해"
            if score < 0.8
            else "깊이 이해"
        )
    return EvalFixture.model_validate(raw)


class FakeProvider:
    def __init__(self, model: str, fixture: EvalFixture) -> None:
        self.model = model
        self.fixture = fixture
        self.concept = load_concept("9수02-03")

    def generate_structured[T: BaseModel](
        self, system: str, user: str, schema: type[T]
    ) -> StructuredResult[T]:
        if schema is Question:
            item_id = user.split("평가 항목 ID: ", 1)[1].splitlines()[0]
            difficulty = user.split("난이도: ", 1)[1].splitlines()[0]
            item = next(
                item for item in self.concept.assessment_items if item.id == item_id
            )
            if item.type == "written":
                question = self.fixture.question.model_copy(
                    update={"difficulty": difficulty}
                )
            else:
                misconception = next(
                    m.id
                    for m in self.concept.misconceptions
                    if item.concept_id in m.concept_ids
                )
                question = Question.model_validate(
                    {
                        "assessment_item_id": item.id,
                        "concept_id": item.concept_id,
                        "level": item.level,
                        "type": item.type,
                        "difficulty": difficulty,
                        "body": "다음 중 옳은 것은? $1+1=2$",
                        "explanation": "등식의 양변을 확인합니다.",
                        "choices": [
                            {
                                "no": n,
                                "text": f"보기 {n}",
                                "is_correct": n == 1,
                                "misconception_id": misconception if n == 2 else None,
                            }
                            for n in range(1, 6)
                        ],
                        "model_answer": None,
                        "rubric": [],
                    }
                )
            parsed = schema.model_validate(question.model_dump())
        elif schema is Review:
            parsed = schema.model_validate(
                {
                    "single_correct_answer": True,
                    "conditions_sufficient": True,
                    "measures_intended_level": True,
                    "issues": [],
                }
            )
        elif schema is Grading:
            answer = user.split("## 학생 답안\n", 1)[1].split("\n", 1)[0]
            case = next(case for case in self.fixture.answers if case.text == answer)
            parsed = schema.model_validate(
                {
                    "element_results": [
                        {"no": int(number), "met": met, "reason": "가짜 판정"}
                        for number, met in case.expected.items()
                    ],
                    "detected_misconception_ids": case.expected_misconceptions,
                }
            )
        elif schema is ReportText:
            parsed = schema.model_validate(
                {
                    "not_understood": "등식의 성질을 다시 살펴보세요.",
                    "misconception_explanations": "헷갈릴 수 있어요.",
                    "next_steps": "양변에 같은 수를 적용해 보세요.",
                }
            )
        else:
            raise ValueError("Unsupported fake schema")
        raw = parsed.model_dump_json()
        return StructuredResult(
            parsed=parsed,
            model=self.model,
            input_tokens=max(1, len(system + user) // 4),
            output_tokens=max(1, len(raw) // 4) + 10,
            reasoning_tokens=10,
            latency_ms=1.0,
            raw_text=raw,
        )


class Recorder(CallHooks):
    def __init__(self, path: Path, max_cost: Decimal, fake: bool) -> None:
        self.path = path
        self.max_cost = max_cost
        self.fake = fake
        self.total = Decimal("0")
        self.entries: list[dict[str, object]] = []

    def before_call(self) -> None:
        if self.total >= self.max_cost:
            raise BudgetExceeded("Standard-price cost limit reached")

    def record(self, entry: dict[str, object]) -> None:
        entry["fake"] = self.fake
        self.entries.append(entry)
        self.total += Decimal(str(entry["cost_usd"]))
        with self.path.open("a", encoding="utf-8") as output:
            output.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 9) if values else None


def make_summary(
    providers: list[str],
    mode: str,
    recorder: Recorder,
    generations: dict[str, list[GenerationOutcome]],
    grades: dict[str, list[tuple[str, GradedAnswer]]],
    reports: dict[str, list[bool]],
    fixture: EvalFixture,
    stopped: bool,
    fake: bool,
) -> dict[str, object]:
    by_provider: dict[str, object] = {}
    expected = {case.id: case for case in fixture.answers}
    for name in providers:
        model = PROVIDER_MODELS[name]
        gen = generations[name]
        grade = grades[name]
        entries = [entry for entry in recorder.entries if entry["model"] == model]
        calls: dict[str, dict[str, object]] = {}
        avg_costs: dict[str, float] = {}
        for kind in ("generate", "review", "grade", "report"):
            group = [entry for entry in entries if entry["call_type"] == kind]
            avg_costs[kind] = (
                _average([float(str(entry["cost_usd"])) for entry in group]) or 0
            )
            calls[kind] = {
                "count": len(group),
                "avg_input_tokens": _average(
                    [float(str(entry["input_tokens"])) for entry in group]
                ),
                "avg_output_tokens": _average(
                    [float(str(entry["output_tokens"])) for entry in group]
                ),
                "avg_reasoning_tokens": _average(
                    [
                        float(str(entry["reasoning_tokens"]))
                        for entry in group
                        if entry["reasoning_tokens"] is not None
                    ]
                ),
                "avg_latency_ms": _average(
                    [float(str(entry["latency_ms"])) for entry in group]
                ),
                "avg_cost_usd": avg_costs[kind] if group else None,
                "total_cost_usd": str(
                    sum(
                        (Decimal(str(entry["cost_usd"])) for entry in group),
                        Decimal("0"),
                    )
                ),
            }
        element_hits = 0
        element_total = 0
        whole_hits = 0
        misconception_hits = 0
        by_answer: dict[str, list[tuple[bool, ...]]] = defaultdict(list)
        for answer_id, result in grade:
            case = expected[answer_id]
            actual = {
                str(element.no): element.met
                for element in result.grading.element_results
            }
            element_hits += sum(
                actual.get(no) == met for no, met in case.expected.items()
            )
            element_total += len(case.expected)
            whole_hits += actual == case.expected
            misconception_hits += set(result.grading.detected_misconception_ids) == set(
                case.expected_misconceptions
            )
            by_answer[answer_id].append(
                tuple(actual.get(no, False) for no in sorted(case.expected))
            )
        repeated = [outcomes for outcomes in by_answer.values() if len(outcomes) == 3]
        review_issues = [
            issue
            for entry in entries
            if entry["call_type"] == "review"
            for issue in cast(list[str], entry["validation"])
        ]
        data: dict[str, object] = {
            "model": model,
            "generation": {
                "requested": len(gen),
                "first_attempt_passed": sum(
                    outcome.question is not None and len(outcome.attempts) == 1
                    for outcome in gen
                ),
                "within_three_passed": sum(
                    outcome.question is not None for outcome in gen
                ),
                "excluded": sum(outcome.excluded for outcome in gen),
                "first_attempt_pass_rate": sum(
                    outcome.question is not None and len(outcome.attempts) == 1
                    for outcome in gen
                )
                / len(gen)
                if gen
                else None,
                "within_three_pass_rate": sum(
                    outcome.question is not None for outcome in gen
                )
                / len(gen)
                if gen
                else None,
                "average_retries": _average(
                    [float(len(outcome.attempts) - 1) for outcome in gen]
                ),
                "review_issues": review_issues,
                "backlog": [
                    {
                        "item_id": outcome.item_id,
                        "concept_id": outcome.concept_id,
                        "level": outcome.level,
                        "difficulty": outcome.difficulty,
                        "attempts": [attempt.__dict__ for attempt in outcome.attempts],
                    }
                    for outcome in gen
                    if outcome.excluded
                ],
            },
            "grading": {
                "answers": len(grade),
                "element_agreement": element_hits / element_total
                if element_total
                else None,
                "whole_agreement": whole_hits / len(grade) if grade else None,
                "three_run_consistency": sum(
                    len(set(outcomes)) == 1 for outcomes in repeated
                )
                / len(repeated)
                if repeated
                else None,
                "misconception_agreement": misconception_hits / len(grade)
                if grade
                else None,
            },
            "report": {
                "count": len(reports[name]),
                "code_passed": sum(reports[name]),
                "code_pass_rate": sum(reports[name]) / len(reports[name])
                if reports[name]
                else None,
            },
            "calls": calls,
            "total_cost_usd": str(
                sum(
                    (Decimal(str(entry["cost_usd"])) for entry in entries), Decimal("0")
                )
            ),
        }
        if mode == "probe":
            averages = avg_costs
            data["full_cost_estimate_usd"] = {
                "no_retries": 12 * averages["generate"]
                + 12 * averages["review"]
                + 30 * averages["grade"]
                + 3 * averages["report"],
                "avg_1_5_attempts": 18 * averages["generate"]
                + 18 * averages["review"]
                + 30 * averages["grade"]
                + 3 * averages["report"],
            }
        by_provider[name] = data
    return {
        "mode": mode,
        "fake": fake,
        "stopped_at_cost_limit": stopped,
        "total_cost_usd": str(recorder.total),
        "providers": by_provider,
    }


def write_summary(out: Path, summary: dict[str, object]) -> None:
    (out / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        f"# AI 제공사 비교 ({summary['mode']}, fake={summary['fake']})",
        "",
        f"표준가 총비용: ${summary['total_cost_usd']}",
        f"비용 상한 중단: {summary['stopped_at_cost_limit']}",
        "",
    ]
    if summary["fake"]:
        lines += [
            "가짜 토큰·비용: 실행 구조 확인용. 실제 비용 추정에 쓰지 않는다.",
            "",
        ]
    providers = cast(dict[str, dict[str, object]], summary["providers"])
    for name, data in providers.items():
        generation = cast(dict[str, object], data["generation"])
        grading = cast(dict[str, object], data["grading"])
        report = cast(dict[str, object], data["report"])
        calls = cast(dict[str, dict[str, object]], data["calls"])
        lines += [
            f"## {name} — {data['model']}",
            "",
            f"생성 요청: {generation['requested']}개",
            f"첫 시도 통과: {generation['first_attempt_passed']}개 "
            f"({generation['first_attempt_pass_rate']})",
            f"3회 안 통과: {generation['within_three_passed']}개 "
            f"({generation['within_three_pass_rate']})",
            f"제외: {generation['excluded']}개; "
            f"평균 재시도: {generation['average_retries']}",
            f"Review 지적: {generation['review_issues']}",
            f"채점: {grading['answers']}회; "
            f"요소 일치 {grading['element_agreement']}; "
            f"전체 일치 {grading['whole_agreement']}",
            f"3회 일관성: {grading['three_run_consistency']}; "
            f"오개념 일치: {grading['misconception_agreement']}",
            f"리포트 코드 검사: {report['code_passed']}/{report['count']} "
            f"({report['code_pass_rate']})",
            "",
            "| 호출 | 횟수 | 평균 입력 | 평균 출력 | 평균 추론 | "
            "평균 지연 ms | 평균 표준가 USD | 총 표준가 USD |",
            "|---|---:|---:|---:|---:|---:|---:|---:|",
        ]
        for kind in ("generate", "review", "grade", "report"):
            group = calls[kind]
            lines.append(
                f"| {kind} | {group['count']} | {group['avg_input_tokens']} | "
                f"{group['avg_output_tokens']} | {group['avg_reasoning_tokens']} | "
                f"{group['avg_latency_ms']} | {group['avg_cost_usd']} | "
                f"{group['total_cost_usd']} |"
            )
        lines += [""]
        if generation["backlog"]:
            lines += [
                "제외 백로그:",
                "",
                "```json",
                json.dumps(generation["backlog"], ensure_ascii=False, indent=2),
                "```",
                "",
            ]
        if "full_cost_estimate_usd" in data:
            estimate = cast(dict[str, float], data["full_cost_estimate_usd"])
            lines += [
                f"Full 비용 추정(표준가): 재시도 없음 ${estimate['no_retries']:.6f}, "
                f"평균 1.5회 시도 ${estimate['avg_1_5_attempts']:.6f}",
                "",
            ]
    (out / "summary.md").write_text("\n".join(lines), encoding="utf-8")


def run(
    providers: list[str],
    mode: Literal["probe", "full"],
    max_cost: Decimal,
    out: Path,
    fake: bool,
) -> dict[str, object]:
    if not providers or any(name not in PROVIDER_MODELS for name in providers):
        raise ValueError("Providers must be gemini,openai")
    if max_cost <= 0:
        raise ValueError("Cost limit must be positive")
    fixture = load_fixture()
    concept = load_concept("9수02-03")
    settings = get_settings()
    expected_calls = len(providers) * (4 if mode == "probe" else 57)
    maximum_calls = len(providers) * (4 if mode == "probe" else 105)
    print(
        f"제공사: {','.join(providers)} | 모드: {mode} | "
        f"예상 호출: {expected_calls}~{maximum_calls} | 표준가 상한: ${max_cost}"
    )
    key_presence = (
        f"Gemini={'있음' if settings.gemini_api_key else '없음'}, "
        f"OpenAI={'있음' if settings.openai_api_key else '없음'}"
    )
    print(f"키 존재: {key_presence}")
    if out.exists() and any(out.iterdir()):
        raise FileExistsError("Output directory already contains files")
    out.mkdir(parents=True, exist_ok=True)
    (out / "calls.jsonl").touch()
    recorder = Recorder(out / "calls.jsonl", max_cost, fake)
    generations: dict[str, list[GenerationOutcome]] = defaultdict(list)
    grades: dict[str, list[tuple[str, GradedAnswer]]] = defaultdict(list)
    reports: dict[str, list[bool]] = defaultdict(list)
    stopped = False
    try:
        for name in providers:
            provider = (
                FakeProvider(PROVIDER_MODELS[name], fixture)
                if fake
                else (
                    GeminiProvider(settings=settings)
                    if name == "gemini"
                    else OpenAIProvider(settings=settings)
                )
            )
            items = (
                [
                    next(
                        item
                        for item in concept.assessment_items
                        if item.id == "9수02-03-C2-성질적용"
                    )
                ]
                if mode == "probe"
                else concept.assessment_items
            )
            difficulties = ("normal",) if mode == "probe" else ("normal", "hard")
            for item in items:
                for difficulty in difficulties:
                    outcome = generate_question(
                        provider,
                        concept,
                        item.id,
                        difficulty,
                        max_attempts=1 if mode == "probe" else 3,
                        hooks=recorder,
                    )
                    generations[name].append(outcome)
            answers = fixture.answers[:1] if mode == "probe" else fixture.answers
            for case in answers:
                for attempt in range(1 if mode == "probe" else 3):
                    try:
                        graded = grade_written(
                            provider,
                            fixture.question,
                            fixture.question.rubric,
                            case.text,
                            target_id=case.id,
                            attempt=attempt + 1,
                            hooks=recorder,
                        )
                    except BudgetExceeded:
                        raise
                    except Exception:
                        continue
                    grades[name].append((case.id, graded))
            report_cases = (
                fixture.report_inputs[1:2] if mode == "probe" else fixture.report_inputs
            )
            for report_case in report_cases:
                try:
                    report = write_report(
                        provider, report_case, target_id=report_case.id, hooks=recorder
                    )
                except BudgetExceeded:
                    raise
                except Exception:
                    continue
                reports[name].append(not report.issues)
    except BudgetExceeded:
        stopped = True
    summary = make_summary(
        providers, mode, recorder, generations, grades, reports, fixture, stopped, fake
    )
    write_summary(out, summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare AI providers for math concept tasks"
    )
    parser.add_argument("--providers", default="gemini,openai")
    parser.add_argument("--mode", choices=("probe", "full"), default="probe")
    parser.add_argument("--max-cost-usd", type=Decimal, default=Decimal("10"))
    parser.add_argument("--fake", action="store_true")
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT
        / "experiments"
        / "ai-provider-compare"
        / datetime.now().strftime("%Y%m%d-%H%M%S"),
    )
    args = parser.parse_args()
    names = [name.strip() for name in args.providers.split(",")]
    summary = run(names, args.mode, args.max_cost_usd, args.out, args.fake)
    print(f"결과: {args.out / 'summary.md'} | 비용: ${summary['total_cost_usd']}")


if __name__ == "__main__":
    main()
