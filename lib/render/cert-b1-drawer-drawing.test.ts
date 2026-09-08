import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { certB1DrawerMachining, CertB1DrawerDrawing } from "./cert-b1-drawer-drawing";

it("derives the front hole and both side grooves from modeled machining", () => {
  const m = certB1DrawerMachining();
  expect(m.front).toEqual({ length: 340, height: 103, thickness: 18, holeX: 170, holeY: 51.5, diameter: 20 });
  expect(m.side.height).toBe(100);
  expect(m.side.thickness).toBe(15);
  expect(m.side.outer).toEqual({ top: 35, height: 15, depth: 8 });
  expect(m.side.inner).toEqual({ top: 85, height: 4, depth: 7 });
});

it("exports self-generated front and side sheets without treating provisional length as cut length", () => {
  for (const kind of ["front", "side"] as const) {
    const svg = renderToStaticMarkup(createElement(CertB1DrawerDrawing, { kind }));
    expect(svg).not.toMatch(/<image|data:image|<script/);
    expect(svg).toContain("鳩尾榫另行核定");
    if (kind === "side") expect(svg).toContain("全長待端榫核定");
    else expect(svg).toContain("Ø20");
  }
});
