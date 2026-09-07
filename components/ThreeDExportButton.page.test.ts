import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it, vi } from "vitest";

it("wires accurate exports to the frozen-or-live raw model, never the assembly display", () => {
  const source = ts.createSourceFile("page.tsx", readFileSync("app/[locale]/design/[type]/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let raw: ts.Expression | undefined;
  let props: ts.JsxAttributes | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "rawDesign") raw = node.initializer;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "ThreeDExportButton") props = node.attributes;
    ts.forEachChild(node, visit);
  };
  visit(source);
  const attr = props?.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === "machiningDesign") as ts.JsxAttribute | undefined;
  expect(attr, "accurate export needs an explicit source model").toBeDefined();
  const initializer = attr!.initializer;
  expect(initializer && ts.isJsxExpression(initializer)).toBe(true);
  const expression = (initializer as ts.JsxExpression).expression!.getText(source);
  const resolve = new Function("frozen", "entry", "applyEdgeProtection", `const length=100,width=60,height=40,material="maple",options={},locale="en"; const rawDesign=${raw!.getText(source)}; return ${expression};`);
  const live = { id: "live-joinery", parts: [{ tenons: [{ length: 10 }] }] };
  const saved = { id: "frozen-joinery", parts: [{ tenons: [{ length: 20 }] }] };
  const template = vi.fn(() => live);
  const protect = vi.fn(model => model);
  expect(resolve(undefined, { template }, protect)).toBe(live);
  template.mockClear();
  expect(resolve({ raw: saved, design: { parts: [] } }, { template }, protect)).toBe(saved);
  expect(template).not.toHaveBeenCalled();
});
