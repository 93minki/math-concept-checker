from functools import lru_cache
from typing import Protocol, cast

from supabase import Client

from app.profiles import _supabase_client
from app.settings import get_settings

Row = dict[str, object]


class BankRepository(Protocol):
    def select(self, table: str) -> list[Row]: ...
    def upsert(self, table: str, rows: list[Row], conflict: str) -> None: ...
    def insert(self, table: str, row: Row) -> None: ...
    def update(self, table: str, row: Row, filters: Row) -> list[Row]: ...
    def insert_question(self, payload: Row) -> None: ...


class SupabaseBank:
    def __init__(self, client: Client) -> None:
        self.client = client

    def select(self, table: str) -> list[Row]:
        rows: list[Row] = []
        while True:
            page = cast(
                list[Row],
                self.client.table(table)
                .select("*")
                .range(len(rows), len(rows) + 999)
                .execute()
                .data,
            )
            rows.extend(page)
            if len(page) < 1000:
                return rows

    def upsert(self, table: str, rows: list[Row], conflict: str) -> None:
        if rows:
            self.client.table(table).upsert(rows, on_conflict=conflict).execute()

    def insert(self, table: str, row: Row) -> None:
        self.client.table(table).insert(row).execute()

    def update(self, table: str, row: Row, filters: Row) -> list[Row]:
        query = self.client.table(table).update(row)
        for key, value in filters.items():
            query = query.eq(key, value)
        return cast(list[Row], query.execute().data)

    def insert_question(self, payload: Row) -> None:
        self.client.rpc("bank_insert_question", {"payload": payload}).execute()


@lru_cache
def get_repository() -> BankRepository:
    settings = get_settings()
    return SupabaseBank(
        _supabase_client(
            str(settings.supabase_url).rstrip("/"),
            settings.supabase_secret_key.get_secret_value(),
        )
    )
