from pydantic import ValidationError

from app.settings import get_settings


def main() -> int:
    try:
        get_settings()
    except ValidationError as exc:
        keys = ", ".join(str(error["loc"][0]) for error in exc.errors())
        print(f"Invalid settings: {keys}")
        return 1
    print("OK: settings valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
