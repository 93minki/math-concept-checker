import argparse
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from app.ai.schemas import load_concept
from app.bank.converter import convert_concepts
from app.bank.curriculum import load_curriculum
from app.bank.operations import change_status, generate
from app.bank.repository import get_repository
from app.bank.review import render_review
from app.bank.transfer import export_bank, import_bank


def main() -> None:
    parser = argparse.ArgumentParser(description="문제 은행 개발자 명령")
    commands = parser.add_subparsers(dest="command", required=True)
    convert = commands.add_parser("convert-concepts")
    convert.add_argument("codes", nargs="+")
    convert.add_argument("--check", action="store_true")
    load = commands.add_parser("load-curriculum")
    load.add_argument("--dry-run", action="store_true")
    gen = commands.add_parser("generate")
    gen.add_argument("--standard", required=True)
    gen.add_argument("--difficulty", choices=["normal", "hard"])
    gen.add_argument("--item")
    cost = gen.add_mutually_exclusive_group()
    cost.add_argument("--max-cost-usd", type=Decimal)
    cost.add_argument("--fake", action="store_true")
    gen.add_argument("--dry-run", action="store_true")
    gen.add_argument("--retry-backlog", action="store_true")
    review = commands.add_parser("review-html")
    review.add_argument("--standard", required=True)
    review.add_argument(
        "--status",
        choices=["validated", "approved", "disabled", "all"],
        default="validated",
    )
    review.add_argument("--out", type=Path)
    approve = commands.add_parser("approve")
    approve.add_argument("--approver", required=True)
    approve.add_argument("ids", nargs="+")
    disable = commands.add_parser("disable")
    disable.add_argument("ids", nargs="+")
    backlog = commands.add_parser("backlog")
    backlog.add_argument("--standard", required=True)
    export = commands.add_parser("export")
    selection = export.add_mutually_exclusive_group(required=True)
    selection.add_argument("--standard")
    selection.add_argument("--all", action="store_true")
    export.add_argument("--out", type=Path, required=True)
    importing = commands.add_parser("import")
    importing.add_argument("file", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "convert-concepts":
            if not convert_concepts(args.codes, args.check):
                raise SystemExit(1)
            return
        if args.command == "load-curriculum":
            counts = load_curriculum(
                None if args.dry_run else get_repository(), args.dry_run
            )
            for name, count in counts.items():
                print(f"{name}: {count}")
            return
        if (
            args.command == "generate"
            and not args.dry_run
            and not args.fake
            and args.max_cost_usd is None
        ):
            parser.error("--max-cost-usd 또는 --fake가 필요합니다")
        repo = get_repository()
        if args.command == "export":
            export_bank(repo, args.out, args.standard)
            print(args.out)
        elif args.command == "import":
            import_bank(repo, args.file)
        elif args.command == "generate":
            generate(
                repo,
                args.standard,
                args.difficulty,
                args.item,
                args.retry_backlog,
                args.fake,
                args.max_cost_usd
                if args.max_cost_usd is not None
                else Decimal("1000000"),
                args.dry_run,
            )
        elif args.command in ("approve", "disable"):
            for result in change_status(
                repo,
                args.ids,
                "approved" if args.command == "approve" else "disabled",
                getattr(args, "approver", ""),
            ):
                print(result)
        else:
            concept = load_concept(args.standard)
            item_ids = {i.id for i in concept.assessment_items}
            pending = [
                b
                for b in repo.select("generation_backlog")
                if b["assessment_item_id"] in item_ids and b.get("resolved_at") is None
            ]
            if args.command == "backlog":
                for row in pending:
                    print(row)
                return
            questions = [
                q
                for q in repo.select("questions")
                if q["assessment_item_id"] in item_ids
                and (args.status == "all" or q["status"] == args.status)
            ]
            html = render_review(
                questions,
                repo.select("question_choices"),
                repo.select("rubric_elements"),
                repo.select("rubric_element_misconceptions"),
                repo.select("misconceptions"),
                pending,
            )
            out = (
                args.out
                or Path(__file__).resolve().parents[3]
                / "experiments"
                / "question-bank"
                / f"review-{datetime.now():%Y%m%d-%H%M%S-%f}.html"
            )
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(html, encoding="utf-8")
            print(out)
    except ValueError as exc:
        # Our own validation messages (no settings or provider details).
        if type(exc) is ValueError:
            raise SystemExit(f"명령 실패: {exc}") from None
        raise SystemExit(f"명령 실패: {type(exc).__name__}") from None
    except Exception as exc:
        # Never print settings, connection URLs, or provider error details.
        raise SystemExit(f"명령 실패: {type(exc).__name__}") from None


if __name__ == "__main__":
    main()
