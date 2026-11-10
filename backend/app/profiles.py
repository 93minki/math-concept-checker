from datetime import UTC, datetime
from functools import lru_cache
from typing import Annotated, Literal, Protocol
from uuid import UUID

from fastapi import Depends
from pydantic import BaseModel
from supabase import Client, create_client

from app.settings import Settings, get_settings


class Profile(BaseModel):
    id: UUID
    signup_status: Literal["pending", "completed"]
    signup_completed_at: datetime | None


class ProfilesRepository(Protocol):
    def get(self, user_id: UUID) -> Profile | None: ...

    def complete_signup(self, user_id: UUID) -> Profile: ...


def check_signup_requirements(user_id: UUID) -> None:
    # F-11: check age and guardian consent here before completing signup.
    pass


class SupabaseProfiles:
    def __init__(self, client: Client) -> None:
        self.client = client

    def get(self, user_id: UUID) -> Profile | None:
        response = (
            self.client.table("profiles")
            .select("id,signup_status,signup_completed_at")
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
        return (
            Profile.model_validate(response.data)
            if response and response.data
            else None
        )

    def complete_signup(self, user_id: UUID) -> Profile:
        existing = self.get(user_id)
        if existing and existing.signup_status == "completed":
            return existing
        check_signup_requirements(user_id)

        completed_at = datetime.now(UTC).isoformat()
        if existing:
            response = (
                self.client.table("profiles")
                .update(
                    {"signup_status": "completed", "signup_completed_at": completed_at}
                )
                .eq("id", str(user_id))
                .eq("signup_status", "pending")
                .execute()
            )
        else:
            response = (
                self.client.table("profiles")
                .upsert(
                    {
                        "id": str(user_id),
                        "signup_status": "completed",
                        "signup_completed_at": completed_at,
                    },
                    on_conflict="id",
                    ignore_duplicates=True,
                )
                .execute()
            )

        if response.data:
            return Profile.model_validate(response.data[0])
        concurrent_result = self.get(user_id)
        if concurrent_result is None:
            raise RuntimeError("Signup completion did not create a profile")
        return concurrent_result


@lru_cache
def _supabase_client(url: str, secret_key: str) -> Client:
    # One client per process; building it per request would recreate HTTP clients.
    return create_client(url, secret_key)


def get_profiles(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ProfilesRepository:
    client = _supabase_client(
        str(settings.supabase_url).rstrip("/"),
        settings.supabase_secret_key.get_secret_value(),
    )
    return SupabaseProfiles(client)
