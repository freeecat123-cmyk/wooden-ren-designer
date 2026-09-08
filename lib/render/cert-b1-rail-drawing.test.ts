import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { CertB1RailDrawing } from "./cert-b1-rail-drawing";

it("renders an original dimensioned rail drawing without embedded source artwork", () => {
  const svg = renderToStaticMarkup(createElement(CertB1RailDrawing));
  expect(svg).toContain("346");
  expect(svg).toContain("R15");
  expect(svg).toContain("70");
  expect(svg).toContain("不含榫頭");
  expect(svg).toContain('width="470mm"');
  expect(svg).not.toMatch(/<image|data:image|<foreignObject|<script/);
  const points = svg.match(/points="([^"]+)"/)![1];
  expect(points).not.toMatch(/\d+\.\d{5}/);
});

it("does not deliver the official drawing through the research page", () => {
  const page = readFileSync("app/[locale]/research/cert-b1/page.tsx", "utf8");
  const preview = readFileSync("app/[locale]/research/cert-b1/AssemblyPreview.tsx", "utf8");
  expect(page).not.toMatch(/readFile|base64|drawings\/page/);
  expect(preview).not.toMatch(/drawingUrl|official-drawing|<img/);
});
