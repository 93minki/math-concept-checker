from fastapi.testclient import TestClient
from pydantic import ValidationError
from pytest import MonkeyPatch, raises

from app import main as main_module
from app.main import app
from app.settings import Settings


def test_health(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(
        main_module,
        "get_settings",
        lambda: Settings(
            _env_file=None,
            SUPABASE_URL="https://example.supabase.co",
            SUPABASE_SECRET_KEY="sb_secret_test-only",
            FRONTEND_ORIGIN="http://localhost:3000",
        ),
    )
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_invalid_settings_stop_startup(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(
        main_module,
        "get_settings",
        lambda: Settings(
            _env_file=None,
            SUPABASE_URL="https://example.supabase.co",
            SUPABASE_SECRET_KEY="sb_publishable_test-only",
            FRONTEND_ORIGIN="http://localhost:3000",
        ),
    )

    with raises(ValidationError), TestClient(app):
        pass
