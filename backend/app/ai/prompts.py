import re
from dataclasses import dataclass
from pathlib import Path

PROMPTS = Path(__file__).resolve().parents[2] / "prompts"
PLACEHOLDER = re.compile(r"\{\{([^{}]+)\}\}")


@dataclass(frozen=True)
class Prompt:
    version: str
    system: str
    user: str


# v1/v2 stay archived; their output schemas are incompatible with current tasks.
PROMPT_VERSION = "v4"


def load_prompt(
    name: str, values: dict[str, str], version: str = PROMPT_VERSION
) -> Prompt:
    if not re.fullmatch(r"[a-z_]+", name) or not re.fullmatch(r"v\d+", version):
        raise ValueError("Invalid prompt name or version")
    source = (PROMPTS / version / f"{name}.md").read_text(encoding="utf-8")
    source = re.sub(r"<!--.*?-->", "", source, flags=re.DOTALL).strip()
    match = re.fullmatch(r"# SYSTEM\s*\n(.*?)\n# USER\s*\n(.*)", source, re.DOTALL)
    if match is None:
        raise ValueError("Prompt needs SYSTEM and USER sections")

    def fill(section: str) -> str:
        missing = set(PLACEHOLDER.findall(section)) - values.keys()
        if missing:
            raise ValueError(f"Missing prompt values: {', '.join(sorted(missing))}")
        result = PLACEHOLDER.sub(lambda found: values[found.group(1)], section)
        if PLACEHOLDER.search(result):
            raise ValueError("Unfilled prompt placeholder")
        return result.strip()

    return Prompt(version, fill(match.group(1)), fill(match.group(2)))
