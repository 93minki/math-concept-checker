import katex from "katex";

export function MathText({ text }: { text: string }) {
  const parts = text.split("$");
  let rendered: string[] | null = null;
  try {
    if (parts.length % 2 === 0 || text.includes("$$")) throw new Error("Invalid math delimiter");
    rendered = parts.map((part, index) => index % 2
      ? katex.renderToString(part, { throwOnError: true, displayMode: false })
      : part);
  } catch {
    rendered = null;
  }
  if (!rendered) return <span className="math-text">{text} <small role="status">수식을 표시하지 못했어요</small></span>;
  return <span className="math-text">{rendered.map((part, index) => index % 2
    ? <span key={index} dangerouslySetInnerHTML={{ __html: part }} />
    : <span key={index}>{part}</span>)}</span>;
}
