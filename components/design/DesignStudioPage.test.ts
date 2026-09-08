import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

const source = ts.createSourceFile("page.tsx", readFileSync("app/[locale]/design/[type]/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const elements: ts.JsxSelfClosingElement[] = [];
function visit(node: ts.Node) {
  if (ts.isJsxSelfClosingElement(node)) elements.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
const named = (name: string) => elements.filter(node => node.tagName.getText(source) === name);

it("composes one shared editor and one parameter form instead of two responsive copies", () => {
  expect(named("DesignStudio")).toHaveLength(1);
  expect(named("ParameterForm")).toHaveLength(1);
  expect(named("MobileShell")).toHaveLength(0);
  expect(named("LazyPerspectiveView")).toHaveLength(1);
  expect(named("LazyPerspectiveView")[0].getText(source)).not.toContain("noSync");
});

it("keeps accurate export geometry separate from the stripped assembly model", () => {
  const exporter = named("ThreeDExportButton")[0];
  expect(exporter.getText(source)).toContain("machiningDesign={applyEdgeProtection(rawDesign)}");
});

it("wires every production view into the shared workspace", () => {
  const studio = named("DesignStudio")[0];
  expect(studio).toBeDefined();
  const props = studio?.attributes.properties.map(p => p.name?.getText(source));
  for (const prop of ["parameters", "model", "drawings", "materials", "build", "quote", "toolbar"]) {
    expect(props).toContain(prop);
  }
});
