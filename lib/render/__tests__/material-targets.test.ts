import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MaterialList } from "../svg-views";
import { certC1 } from "@/lib/templates/cert-c1";

it("provides material-row destinations for ready-made dowels as well as wood stock", () => {
  const design = certC1({ length: 320, width: 120, height: 350, material: "pine" });
  const html = renderToStaticMarkup(createElement(MaterialList, { design }));
  for (const part of design.parts) expect(html).toContain(`data-part-id="${part.id}"`);
});
