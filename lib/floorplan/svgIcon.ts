import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

/** Render a React element to inline-encoded data:image/svg+xml URL（給 Konva.Image / <img> 用）。 */
export function svgElementToDataUrl(element: ReactElement): string {
  const markup = renderToStaticMarkup(element);
  return `data:image/svg+xml;utf8,${encodeURIComponent(markup)}`;
}
