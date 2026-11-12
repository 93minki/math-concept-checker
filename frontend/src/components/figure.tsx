import { createElement } from "react";
import { drawFigure, type Figure as FigureData } from "../lib/figures";

export function Figure({ figure }: { figure: FigureData }) {
  const drawing = drawFigure(figure);
  return (
    <svg
      className="figure"
      viewBox={drawing.viewBox}
      role="img"
      aria-label="문제 그림"
    >
      {drawing.elements.map((element, index) =>
        createElement(
          element.tag,
          { ...element.attrs, key: index },
          element.text,
        ),
      )}
    </svg>
  );
}
