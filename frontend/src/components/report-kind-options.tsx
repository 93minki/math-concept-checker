import { reportKinds, type ReportKind } from "@/lib/reports-api";

export function ReportKindOptions({
  itemId,
  kind,
  onChange,
}: {
  itemId: number;
  kind: ReportKind | "";
  onChange: (kind: ReportKind) => void;
}) {
  return (
    <fieldset className="report-kind-grid">
      <legend>어떤 오류인가요?</legend>
      {(Object.entries(reportKinds) as [ReportKind, string][]).map(
        ([value, label]) => (
          <label key={value} className="report-kind-option">
            <input
              type="radio"
              name={`kind-${itemId}`}
              value={value}
              checked={kind === value}
              onChange={() => onChange(value)}
              required
            />
            {label}
          </label>
        ),
      )}
    </fieldset>
  );
}
