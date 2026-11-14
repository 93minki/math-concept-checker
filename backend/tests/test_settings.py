from pathlib import Path

import pytest
from pydantic import ValidationError

from app import check_settings
from app.settings import Settings

VALID = {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_SECRET_KEY": "sb_secret_test-only",
    "FRONTEND_ORIGIN": "http://localhost:3000",
    "KAKAO_ADMIN_KEY": "example-key",
}


@pytest.fixture(autouse=True)
def fake_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in VALID.items():
        monkeypatch.setenv(key, value)


def test_valid_settings() -> None:
    settings = Settings(_env_file=None)

    assert str(settings.supabase_url) == VALID["SUPABASE_URL"] + "/"
    assert settings.cors_origins == [VALID["FRONTEND_ORIGIN"]]
    assert VALID["SUPABASE_SECRET_KEY"] not in repr(settings)
    assert VALID["SUPABASE_SECRET_KEY"] not in str(settings.supabase_secret_key)


@pytest.mark.parametrize("missing", list(VALID))
def test_missing_setting(missing: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(missing)

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)

    assert missing in str(exc_info.value)
    assert VALID["SUPABASE_SECRET_KEY"] not in str(exc_info.value)


@pytest.mark.parametrize(
    "invalid", ["eyJlegacy-test", "sb_publishable_test-only", "wrong-test-key"]
)
def test_secret_key_format(invalid: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_SECRET_KEY", invalid)

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)

    assert "SUPABASE_SECRET_KEY" in str(exc_info.value)
    assert invalid not in str(exc_info.value)


@pytest.mark.parametrize(
    ("key", "invalid"),
    [
        ("SUPABASE_URL", "http://example.supabase.co"),
        ("SUPABASE_URL", "https://bad host"),
        ("FRONTEND_ORIGIN", "ftp://localhost:3000"),
    ],
)
def test_url_format(key: str, invalid: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(key, invalid)

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)

    assert key in str(exc_info.value)
    assert invalid not in str(exc_info.value)


def test_cors_origins_are_trimmed_and_normalized(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "FRONTEND_ORIGIN", "  http://localhost:3000/ , https://example.test:3000/  "
    )

    assert Settings(_env_file=None).cors_origins == [
        "http://localhost:3000",
        "https://example.test:3000",
    ]


@pytest.mark.parametrize(
    "invalid",
    [
        "",
        " ",
        ",http://localhost:3000",
        "http://localhost:3000,",
        "http://localhost:3000, ,https://example.test",
        "http://localhost:3000,ftp://bad.test",
        "http://localhost:3000,not a url",
    ],
)
def test_invalid_cors_origins_are_not_exposed(
    invalid: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", invalid)
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "FRONTEND_ORIGIN" in str(exc_info.value)
    if invalid.strip():
        assert invalid not in str(exc_info.value)


def test_env_file_is_inside_backend_folder() -> None:
    env_file = Settings.model_config["env_file"]

    assert isinstance(env_file, Path)
    assert env_file.parent.name == "backend"
    assert env_file.name == ".env"


def test_check_command_reports_only_key_names(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("SUPABASE_SECRET_KEY")
    monkeypatch.setattr(
        check_settings, "get_settings", lambda: Settings(_env_file=None)
    )

    assert check_settings.main() == 1
    assert capsys.readouterr().out == "Invalid settings: SUPABASE_SECRET_KEY\n"
