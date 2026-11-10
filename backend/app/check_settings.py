from pydantic import ValidationError

from app.settings import get_settings


def main() -> int:
    try:
        settings = get_settings()
    except ValidationError as exc:
        keys = ", ".join(str(error["loc"][0]) for error in exc.errors())
        print(f"Invalid settings: {keys}")
        return 1
    print("OK: settings valid")
    for name, key in (
        ("GEMINI_API_KEY", settings.gemini_api_key),
        ("OPENAI_API_KEY", settings.openai_api_key),
        ("ANTHROPIC_API_KEY", settings.anthropic_api_key),
    ):
        print(f"{name}: {'있음' if key else '없음'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
