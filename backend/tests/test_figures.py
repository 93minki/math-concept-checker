import pytest
from openai.lib._pydantic import to_strict_json_schema
from pydantic import TypeAdapter

from app.ai.prompts import load_prompt
from app.ai.schemas import Figure, QuestionDraft, load_concept
from app.ai.tasks import _context
from app.ai.validators import validate_figure


@pytest.mark.parametrize(
    ("data", "invalid"),
    [
        (
            {
                "kind": "number_line",
                "min": -2,
                "max": 2,
                "tick_step": 1,
                "label_step": 1,
                "points": [],
                "rays": [],
                "segments": [],
            },
            {"tick_step": 0},
        ),
        (
            {
                "kind": "coordinate_plane",
                "x_min": -2,
                "x_max": 2,
                "y_min": -2,
                "y_max": 2,
                "tick_step": 1,
                "show_tick_labels": True,
                "points": [],
                "graphs": [],
            },
            {"x_min": 1},
        ),
        (
            {
                "kind": "bar_chart",
                "categories": ["가"],
                "values": [2],
                "y_max": 4,
                "y_step": 1,
                "x_label": None,
                "y_label": None,
            },
            {"values": [5]},
        ),
        (
            {
                "kind": "frequency",
                "class_start": 0,
                "class_width": 1,
                "frequencies": [1],
                "show_bars": True,
                "show_polygon": False,
                "y_step": 1,
                "x_label": None,
                "y_label": None,
            },
            {"frequencies": [-1]},
        ),
        (
            {
                "kind": "boxplot",
                "axis_min": 0,
                "axis_max": 10,
                "axis_step": 1,
                "series": [
                    {"label": "가", "min": 1, "q1": 2, "median": 3, "q3": 4, "max": 5}
                ],
            },
            {"axis_max": 4},
        ),
        (
            {
                "kind": "scatter",
                "x_min": 0,
                "x_max": 10,
                "x_step": 1,
                "y_min": 0,
                "y_max": 10,
                "y_step": 1,
                "x_label": None,
                "y_label": None,
                "points": [{"x": 2, "y": 3}],
            },
            {"x_max": 1},
        ),
    ],
)
def test_figure_rules(data: dict[str, object], invalid: dict[str, object]) -> None:
    adapter = TypeAdapter(Figure)
    assert not validate_figure(adapter.validate_python(data), "9수02-03")
    assert validate_figure(adapter.validate_python({**data, **invalid}), "9수02-03")


def test_strict_schema_and_prompt_versions() -> None:
    schema = to_strict_json_schema(QuestionDraft)
    assert "figure" in schema["required"]
    assert "figure" in schema["$defs"]["DraftChoice"]["required"]
    concept = load_concept("9수02-03")
    item = concept.assessment_items[0]
    context = _context(concept, item, "normal")
    for name in ("generate_question", "review_question"):
        values = {**context, "question_json": "{}", "declared_hard_condition": "없음"}
        old = load_prompt(name, values, version="v7")
        new = load_prompt(name, values, version="v8")
        assert old.system.split() == new.system.split()
        assert old.user.split() == new.user.split()
        with_figure = item.model_copy(
            update={"figure": "body", "figure_kinds": ["boxplot"]}
        )
        values.update(_context(concept, with_figure, "normal"))
        assert "boxplot" in load_prompt(name, values, version="v8").user


def test_figure_location_and_labels() -> None:
    from test_ai import FakeChecker, good_question

    from app.ai.schemas import Boxplot
    from app.ai.validators import validate_question

    concept = load_concept("9수02-03")
    question = good_question()
    item = next(
        i for i in concept.assessment_items if i.id == question.assessment_item_id
    )
    figure = Boxplot.model_validate(
        {
            "kind": "boxplot",
            "axis_min": 0,
            "axis_max": 10,
            "axis_step": 1,
            "series": [
                {"label": "가", "min": 1, "q1": 2, "median": 3, "q3": 4, "max": 5}
            ],
        }
    )
    question.figure = figure
    assert "figure_unexpected" in {
        i.code for i in validate_question(question, concept, FakeChecker())
    }
    item.figure = "body"
    item.figure_kinds = ["boxplot"]
    assert not validate_question(question, concept, FakeChecker())
    item.figure = "choices"
    question.figure = None
    for choice in question.choices:
        choice.figure = figure
        choice.text = ""
    assert not validate_question(question, concept, FakeChecker())
    question.choices[0].figure = None
    assert "figure_choices" in {
        i.code for i in validate_question(question, concept, FakeChecker())
    }
    figure.series[0].label = "인수분해"
    assert "figure_banned_term" in {
        i.code for i in validate_figure(figure, concept.standard_code)
    }
    figure.series[0].label = "<그림>"
    assert "figure_label" in {
        i.code for i in validate_figure(figure, concept.standard_code)
    }
