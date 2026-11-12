import { drawFigure, type Figure } from "../src/lib/figures/index.ts";

const escape = (value: string | number) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const attrName = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
let input = "";
for await (const chunk of process.stdin) input += chunk;
const figures: Figure[] = JSON.parse(input);
const result = figures.map((figure) => {
  const drawing = drawFigure(figure);
  const children = drawing.elements
    .map(({ tag, attrs, text }) => {
      const attributes = Object.entries(attrs)
        .map(([name, value]) => ` ${attrName(name)}="${escape(value)}"`)
        .join("");
      return `<${tag}${attributes}>${text === undefined ? "" : escape(text)}</${tag}>`;
    })
    .join("");
  return `<svg viewBox="${escape(drawing.viewBox)}" role="img" aria-label="문제 그림" style="width:100%;max-width:400px;height:auto">${children}</svg>`;
});
process.stdout.write(JSON.stringify(result));
