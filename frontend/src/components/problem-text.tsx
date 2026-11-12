import { MathText } from "./math-text";

function cells(line: string): string[] | null {
  let math = false;
  let cell = "";
  const result: string[] = [];
  for (const char of line.trim()) {
    if (char === "$") math = !math;
    if (char === "|" && !math) {
      result.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  if (!result.length) return null;
  result.push(cell.trim());
  if (!result[0]) result.shift();
  if (!result[result.length - 1]) result.pop();
  return result;
}

export function ProblemText({
  text,
  prefix,
}: {
  text: string;
  prefix?: string;
}) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) {
      blocks.push(
        <MathText key={`p${blocks.length}`} text={plain.join("\n")} />,
      );
      plain = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const header = cells(lines[i]);
    const separator = i + 1 < lines.length ? cells(lines[i + 1]) : null;
    const firstRow = i + 2 < lines.length ? cells(lines[i + 2]) : null;
    if (
      !header ||
      !separator ||
      !firstRow ||
      header.length !== separator.length ||
      firstRow.length !== header.length ||
      !separator.every((c) => /^:?-{3,}:?$/.test(c))
    ) {
      plain.push(lines[i]);
      continue;
    }
    flush();
    const rows: string[][] = [];
    i += 2;
    while (i < lines.length) {
      const row = cells(lines[i]);
      if (!row || row.length !== header.length) {
        i--;
        break;
      }
      rows.push(row);
      i++;
    }
    blocks.push(
      <div className="table-scroll" key={`t${blocks.length}`}>
        <table className="problem-table">
          <thead>
            <tr>
              {header.map((c, j) => (
                <th key={j}>
                  <MathText text={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, j) => (
              <tr key={j}>
                {row.map((c, k) => (
                  <td key={k}>
                    <MathText text={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }
  flush();
  return (
    <div className="problem-text">
      {prefix}
      {blocks}
    </div>
  );
}
