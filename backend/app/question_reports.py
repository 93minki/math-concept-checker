from functools import lru_cache
from typing import Annotated, Literal, Protocol, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from postgrest.exceptions import APIError
from pydantic import BaseModel, ConfigDict, Field
from supabase import Client

from app.auth import AuthUser, get_current_user
from app.profiles import _supabase_client
from app.question_revision_ai import RevisionEngine, get_revision_engine
from app.settings import Settings, get_settings

ReportKind = Literal["text", "choice_answer", "figure", "out_of_curriculum", "other"]
Row = dict[str, object]


class ReportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    diagnosis_item_id: int = Field(gt=0)
    kind: ReportKind
    description: str = Field(default="", max_length=500)


class DuplicateReport(Exception):
    pass


class ReportRepository(Protocol):
    def is_admin(self, user_id: UUID) -> bool: ...
    def grouped_reports(self, report_status: str | None) -> list[Row]: ...
    def question_details(self, question_id: UUID) -> Row | None: ...
    def save_revision(self, row: Row) -> Row: ...
    def revision(self, revision_id: UUID) -> Row | None: ...
    def replace_question(self, revision_id: UUID, admin_id: UUID) -> UUID: ...
    def update_reports(
        self, question_id: UUID, target: str, note: str | None
    ) -> int: ...
    def question_for_item(self, user_id: UUID, item_id: int) -> UUID | None: ...
    def create(
        self,
        user_id: UUID,
        item_id: int,
        question_id: UUID,
        kind: str,
        description: str,
    ) -> Row: ...
    def list_own(self, user_id: UUID) -> list[Row]: ...


class SupabaseReports:
    def __init__(self, client: Client) -> None:
        self.client = client

    def is_admin(self, user_id: UUID) -> bool:
        return bool(
            self.client.table("admins")
            .select("user_id")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
            .data
        )

    def grouped_reports(self, report_status: str | None) -> list[Row]:
        groups: dict[str, Row] = {}
        offset = 0
        while True:
            query = (
                self.client.table("question_reports")
                .select("question_id,status,created_at")
                .order("created_at", desc=True)
            )
            if report_status:
                query = query.eq("status", report_status)
            page = cast(list[Row], query.range(offset, offset + 999).execute().data)
            for report in page:
                qid = str(report["question_id"])
                if qid not in groups:
                    groups[qid] = {
                        "question_id": qid,
                        "report_count": 0,
                        "latest_report_at": report["created_at"],
                        "statuses": [],
                    }
                group = groups[qid]
                group["report_count"] = int(str(group["report_count"])) + 1
                statuses = cast(list[str], group["statuses"])
                if str(report["status"]) not in statuses:
                    statuses.append(str(report["status"]))
            offset += len(page)
            if len(page) < 1000:
                return list(groups.values())

    def question_details(self, question_id: UUID) -> Row | None:
        qid = str(question_id)
        questions = cast(
            list[Row],
            self.client.table("questions").select("*").eq("id", qid).execute().data,
        )
        if not questions:
            return None
        choices = cast(
            list[Row],
            self.client.table("question_choices")
            .select("*")
            .eq("question_id", qid)
            .order("no")
            .execute()
            .data,
        )
        rubric = cast(
            list[Row],
            self.client.table("rubric_elements")
            .select("*")
            .eq("question_id", qid)
            .order("no")
            .execute()
            .data,
        )
        links: list[Row] = []
        if rubric:
            links = cast(
                list[Row],
                self.client.table("rubric_element_misconceptions")
                .select("rubric_element_id,misconception_id")
                .in_("rubric_element_id", [int(str(r["id"])) for r in rubric])
                .execute()
                .data,
            )
        reports = cast(
            list[Row],
            self.client.table("question_reports")
            .select(
                "id,kind,description,status,created_at,resolved_at,resolution_note,replacement_question_id"
            )
            .eq("question_id", qid)
            .order("created_at", desc=True)
            .execute()
            .data,
        )
        revisions = cast(
            list[Row],
            self.client.table("question_revisions")
            .select("*")
            .eq("question_id", qid)
            .order("created_at", desc=True)
            .execute()
            .data,
        )
        return {
            "question": questions[0],
            "choices": choices,
            "rubric": rubric,
            "rubric_links": links,
            "reports": reports,
            "revisions": revisions,
        }

    def save_revision(self, row: Row) -> Row:
        return cast(
            Row, self.client.table("question_revisions").insert(row).execute().data[0]
        )

    def revision(self, revision_id: UUID) -> Row | None:
        rows = cast(
            list[Row],
            self.client.table("question_revisions")
            .select("*")
            .eq("id", str(revision_id))
            .execute()
            .data,
        )
        return rows[0] if rows else None

    def replace_question(self, revision_id: UUID, admin_id: UUID) -> UUID:
        value = (
            self.client.rpc(
                "bank_replace_question",
                {"p_revision_id": str(revision_id), "p_admin_id": str(admin_id)},
            )
            .execute()
            .data
        )
        return UUID(str(value))

    def update_reports(self, question_id: UUID, target: str, note: str | None) -> int:
        from datetime import UTC, datetime

        changes: Row = {"status": target}
        if target == "no_issue":
            changes.update(
                resolution_note=note, resolved_at=datetime.now(UTC).isoformat()
            )
        data = (
            self.client.table("question_reports")
            .update(changes)
            .eq("question_id", str(question_id))
            .in_("status", ["received", "in_review"])
            .execute()
            .data
        )
        return len(data)

    def question_for_item(self, user_id: UUID, item_id: int) -> UUID | None:
        result = (
            self.client.table("diagnosis_items")
            .select("question_id")
            .eq("id", item_id)
            .eq("user_id", str(user_id))
            .execute()
        )
        if not result.data:
            return None
        row = cast(Row, result.data[0])
        return UUID(str(row["question_id"]))

    def create(
        self,
        user_id: UUID,
        item_id: int,
        question_id: UUID,
        kind: str,
        description: str,
    ) -> Row:
        try:
            response = (
                self.client.table("question_reports")
                .insert(
                    {
                        "user_id": str(user_id),
                        "diagnosis_item_id": item_id,
                        "question_id": str(question_id),
                        "kind": kind,
                        "description": description,
                    }
                )
                .execute()
            )
        except APIError as exc:
            if exc.code == "23505":
                raise DuplicateReport from exc
            raise
        data = cast(Row, response.data[0])
        return {
            key: data.get(key)
            for key in ("id", "kind", "description", "status", "created_at")
        }

    def list_own(self, user_id: UUID) -> list[Row]:
        # Explicit fields avoid disclosing question-bank answers or explanations.
        rows: list[Row] = []
        while True:
            response = (
                self.client.table("question_reports")
                .select(
                    "id,kind,description,status,created_at,resolved_at,diagnosis_items(stage,position,diagnoses(display_units(grade,number,name)))"
                )
                .eq("user_id", str(user_id))
                .order("created_at", desc=True)
                .range(len(rows), len(rows) + 999)
                .execute()
            )
            page = cast(list[Row], response.data)
            rows.extend(page)
            if len(page) < 1000:
                return rows


@lru_cache
def _repository(url: str, secret: str) -> SupabaseReports:
    return SupabaseReports(_supabase_client(url, secret))


def get_report_repository(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ReportRepository:
    return _repository(
        str(settings.supabase_url).rstrip("/"),
        settings.supabase_secret_key.get_secret_value(),
    )


router = APIRouter()
User = Annotated[AuthUser, Depends(get_current_user)]
Repo = Annotated[ReportRepository, Depends(get_report_repository)]


@router.post("/question-reports", status_code=status.HTTP_201_CREATED)
def submit_report(data: ReportInput, user: User, repo: Repo) -> Row:
    question_id = repo.question_for_item(user.id, data.diagnosis_item_id)
    if question_id is None:
        raise HTTPException(status_code=404, detail="Diagnosis item not found")
    try:
        return repo.create(
            user.id, data.diagnosis_item_id, question_id, data.kind, data.description
        )
    except DuplicateReport as exc:
        raise HTTPException(status_code=409, detail="Report already exists") from exc


@router.get("/question-reports")
def own_reports(user: User, repo: Repo) -> list[Row]:
    return repo.list_own(user.id)


ReportStatus = Literal["received", "in_review", "fixed", "no_issue"]


def require_admin(user: User, repo: Repo) -> AuthUser:
    if not repo.is_admin(user.id):
        raise HTTPException(status_code=403, detail="Administrator required")
    return user


Admin = Annotated[AuthUser, Depends(require_admin)]
Engine = Annotated[RevisionEngine, Depends(get_revision_engine)]


class ManualRevision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payload: Row


class Resolution(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str


def _details(question_id: UUID, repo: ReportRepository) -> Row:
    details = repo.question_details(question_id)
    if details is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return details


@router.get("/admin/reports")
def admin_reports(
    admin: Admin,
    repo: Repo,
    report_status: Annotated[ReportStatus | None, Query(alias="status")] = None,
) -> list[Row]:
    return repo.grouped_reports(report_status)


@router.get("/admin/questions/{question_id}")
def admin_question(question_id: UUID, admin: Admin, repo: Repo) -> Row:
    return _details(question_id, repo)


@router.post("/admin/questions/{question_id}/revisions/ai", status_code=201)
def ai_revision(question_id: UUID, admin: Admin, repo: Repo, engine: Engine) -> Row:
    details = _details(question_id, repo)
    try:
        result = engine.generate(details)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="Revision generation failed"
        ) from exc
    return repo.save_revision(
        {
            **result,
            "question_id": str(question_id),
            "source": "ai",
            "created_by": str(admin.id),
        }
    )


@router.post("/admin/questions/{question_id}/revisions", status_code=201)
def manual_revision(
    question_id: UUID, data: ManualRevision, admin: Admin, repo: Repo, engine: Engine
) -> Row:
    details = _details(question_id, repo)
    try:
        result = engine.check_manual(details, data.payload)
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid revision payload") from exc
    return repo.save_revision(
        {
            **result,
            "question_id": str(question_id),
            "source": "manual",
            "created_by": str(admin.id),
        }
    )


@router.post("/admin/revisions/{revision_id}/approve")
def approve_revision(revision_id: UUID, admin: Admin, repo: Repo) -> Row:
    revision = repo.revision(revision_id)
    if revision is None or revision.get("status") != "passed":
        raise HTTPException(status_code=409, detail="Revision is not eligible")
    try:
        replacement = repo.replace_question(revision_id, admin.id)
    except APIError as exc:
        if exc.code in ("P0001", "23505"):
            raise HTTPException(
                status_code=409, detail="Revision is not eligible"
            ) from exc
        raise
    return {"replacement_question_id": str(replacement), "export_needed": True}


@router.post("/admin/questions/{question_id}/no-issue")
def no_issue(question_id: UUID, data: Resolution, admin: Admin, repo: Repo) -> Row:
    _details(question_id, repo)
    return {"updated": repo.update_reports(question_id, "no_issue", data.note)}


@router.post("/admin/questions/{question_id}/in-review")
def in_review(question_id: UUID, admin: Admin, repo: Repo) -> Row:
    _details(question_id, repo)
    return {"updated": repo.update_reports(question_id, "in_review", None)}
