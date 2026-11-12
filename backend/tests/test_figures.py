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


def test_geometry_validation_and_strict_schema() -> None:
    figure = {
        "kind": "geometry",
        "points": [
            {"id": "A", "x": 0, "y": 0, "show_name": True, "dot": True},
            {"id": "B", "x": 4, "y": 0, "show_name": True, "dot": True},
            {"id": "C", "x": 0, "y": 4, "show_name": True, "dot": True},
        ],
        "segments": [
            {
                "from": "A",
                "to": "B",
                "dashed": False,
                "ticks": 1,
                "parallel_marks": 0,
                "label": "4",
            },
            {
                "from": "A",
                "to": "C",
                "dashed": False,
                "ticks": 1,
                "parallel_marks": 0,
                "label": "4",
            },
        ],
        "lines": [],
        "polygons": [],
        "circles": [],
        "arcs": [],
        "angles": [
            {
                "vertex": "A",
                "from": "B",
                "to": "C",
                "label": "90°",
                "right": True,
                "marks": 1,
            }
        ],
    }
    adapter = TypeAdapter(Figure)
    assert not validate_figure(adapter.validate_python(figure), "9수03-02")
    points = figure["points"]
    assert isinstance(points, list)
    changed = {**figure, "points": [*points[:2], {**points[2], "x": 1}]}
    assert validate_figure(adapter.validate_python(changed), "9수03-02")
    schema = to_strict_json_schema(QuestionDraft)
    for name in ("CoordinatePlane", "BarChart", "Frequency"):
        definition = schema["$defs"][name]
        assert set(definition["required"]) == set(definition["properties"])


def test_v9_without_figures_matches_v8() -> None:
    concept = load_concept("9수02-03")
    values = {
        **_context(concept, concept.assessment_items[0], "normal"),
        "question_json": "{}",
        "declared_hard_condition": "없음",
    }
    for name in ("generate_question", "review_question"):
        old = load_prompt(name, values, version="v8")
        new = load_prompt(name, values, version="v9")
        assert (old.system, old.user) == (new.system, new.user)


def test_existing_bank_figures_read() -> None:
    import json
    from pathlib import Path

    adapter = TypeAdapter(Figure)
    for path in (Path(__file__).resolve().parents[1] / "data" / "bank").glob("*.json"):
        bank = json.loads(path.read_text(encoding="utf-8"))
        for question in bank["questions"]:
            for row in [question, *question.get("choices", [])]:
                if row.get("figure") is not None:
                    adapter.validate_python(row["figure"])


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ("right", "geometry_right"),
        ("ticks", "geometry_ticks"),
        ("parallel", "geometry_parallel"),
        ("angle", "geometry_angle_label"),
        ("length", "geometry_lengths"),
        ("circle", "geometry_circle"),
        ("reference", "geometry_reference"),
        ("count", "geometry_count"),
    ],
)
def test_geometry_rejects_bad_data(change: str, code: str) -> None:
    points = [
        {"id": name, "x": x, "y": y, "dot": True, "show_name": True}
        for name, x, y in [("A", 0, 0), ("B", 4, 0), ("C", 0, 4), ("D", 4, 4)]
    ]
    segments = [
        {
            "from": a,
            "to": b,
            "dashed": False,
            "ticks": 1,
            "parallel_marks": 1,
            "label": "4",
        }
        for a, b in [("A", "B"), ("C", "D")]
    ]
    angles = [
        {
            "vertex": "A",
            "from": "B",
            "to": "C",
            "label": "90°",
            "right": True,
            "marks": 1,
        }
    ]
    figure: dict[str, object] = {
        "kind": "geometry",
        "points": points,
        "segments": segments,
        "lines": [],
        "polygons": [],
        "circles": [],
        "arcs": [],
        "angles": angles,
    }
    adapter = TypeAdapter(Figure)
    assert not validate_figure(adapter.validate_python(figure), "9수03-02")
    if change == "right":
        points[2]["x"] = 0.07
    elif change == "ticks":
        points[3]["x"] = 6
    elif change == "parallel":
        points[3]["y"] = 5
    elif change == "angle":
        angles[0]["label"] = "60°"
    elif change == "length":
        segments[1]["label"] = "9"
    elif change == "circle":
        figure["circles"] = [
            {"center": "A", "radius": 2, "dashed": False, "points_on": ["B"]}
        ]
    elif change == "reference":
        segments[0]["to"] = "Z"
    else:
        points.extend(
            {"id": f"P{i}", "x": i, "y": 0, "dot": False, "show_name": False}
            for i in range(11)
        )
    assert "figure_" + code in {
        i.code for i in validate_figure(adapter.validate_python(figure), "9수03-02")
    }


def test_solid_and_relative_frequency_invalid() -> None:
    adapter = TypeAdapter(Figure)
    solid = {
        "kind": "solid",
        "shape": "cuboid",
        "base_sides": None,
        "width": 2,
        "depth": 3,
        "height": 4,
        "radius": None,
        "top_radius": None,
        "vertex_names": list("ABCDEFGH"),
        "labels": [],
        "show_axis": False,
    }
    frequency = {
        "kind": "frequency",
        "class_start": 0,
        "class_width": 1,
        "frequencies": [0.5, 0.5],
        "relative": True,
        "compare_frequencies": [0.4, 0.6],
        "series_labels": ["가", "나"],
        "show_bars": False,
        "show_polygon": True,
        "y_step": 0.1,
        "x_label": None,
        "y_label": None,
    }
    assert not validate_figure(adapter.validate_python(solid), "9수03-02")
    assert not validate_figure(adapter.validate_python(frequency), "9수04-03")
    assert "figure_solid_vertices" in {
        i.code
        for i in validate_figure(
            adapter.validate_python({**solid, "vertex_names": ["A"]}), "9수03-02"
        )
    }
    assert "figure_frequency_distribution" in {
        i.code
        for i in validate_figure(
            adapter.validate_python({**frequency, "frequencies": [0.2, 0.2]}),
            "9수04-03",
        )
    }


def test_angle_marks_zero_and_matching_groups() -> None:
    angles: list[dict[str, object]] = [
        {
            "vertex": "O",
            "from": "A",
            "to": "B",
            "label": "90°",
            "right": False,
            "marks": 0,
        },
        {
            "vertex": "O",
            "from": "A",
            "to": "C",
            "label": "x",
            "right": False,
            "marks": 0,
        },
    ]
    figure = {
        "kind": "geometry",
        "points": [
            {"id": name, "x": x, "y": y, "show_name": True, "dot": True}
            for name, x, y in [("O", 0, 0), ("A", 4, 0), ("B", 0, 4), ("C", 4, 4)]
        ],
        "segments": [],
        "lines": [],
        "polygons": [],
        "circles": [],
        "arcs": [],
        "angles": angles,
    }
    adapter = TypeAdapter(Figure)
    assert not validate_figure(adapter.validate_python(figure), "9수03-02")
    angles[0]["marks"] = 1
    angles[1]["marks"] = 1
    assert "figure_geometry_angle_marks" in {
        issue.code
        for issue in validate_figure(adapter.validate_python(figure), "9수03-02")
    }
    angles[1]["marks"] = 2
    assert not validate_figure(adapter.validate_python(figure), "9수03-02")
    angles[1]["marks"] = 4
    with pytest.raises(ValueError):
        adapter.validate_python(figure)


@pytest.mark.parametrize("label", ["2x", "x+1", "3a", "4foo"])
def test_expression_length_labels_are_not_ratios(label: str) -> None:
    figure = {
        "kind": "geometry",
        "points": [
            {"id": name, "x": x, "y": 0, "show_name": True, "dot": True}
            for name, x in [("A", 0), ("B", 2), ("C", 4)]
        ],
        "segments": [
            {
                "from": a,
                "to": b,
                "dashed": False,
                "ticks": 0,
                "parallel_marks": 0,
                "label": value,
            }
            for a, b, value in [("A", "B", "2"), ("B", "C", label)]
        ],
        "lines": [],
        "polygons": [],
        "circles": [],
        "arcs": [],
        "angles": [],
    }
    assert "figure_geometry_lengths" not in {
        i.code
        for i in validate_figure(
            TypeAdapter(Figure).validate_python(figure), "9수03-02"
        )
    }


@pytest.mark.parametrize("label", ["4", "4mm", "4 cm", "4m", "4km"])
def test_numeric_length_labels_are_checked(label: str) -> None:
    figure = {
        "kind": "geometry",
        "points": [
            {"id": name, "x": x, "y": 0, "show_name": True, "dot": True}
            for name, x in [("A", 0), ("B", 2), ("C", 4)]
        ],
        "segments": [
            {
                "from": a,
                "to": b,
                "dashed": False,
                "ticks": 0,
                "parallel_marks": 0,
                "label": value,
            }
            for a, b, value in [("A", "B", "2"), ("B", "C", label)]
        ],
        "lines": [],
        "polygons": [],
        "circles": [],
        "arcs": [],
        "angles": [],
    }
    assert "figure_geometry_lengths" in {
        i.code
        for i in validate_figure(
            TypeAdapter(Figure).validate_python(figure), "9수03-02"
        )
    }
