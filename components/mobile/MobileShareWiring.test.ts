import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

function propsAt(path: string, component: string) {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches: Record<string, string>[] = [];
  function visit(node: ts.Node) {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === component) {
      matches.push(Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map((attr) => [attr.name.getText(file), attr.initializer?.getText(file) ?? "true"])));
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return matches;
}

it("passes the same verified revision and dirty status to desktop and mobile sharing", () => {
  const path = "app/[locale]/design/[type]/page.tsx";
  const desktop = propsAt(path, "ShareDesignButton")[0];
  const mobile = propsAt(path, "MobileShell")[0];
  expect(mobile.savedRevision).toBe(desktop.savedRevision);
  expect(mobile.hasUnsavedChanges).toBe(desktop.hasUnsavedChanges);
  expect(mobile.currentDesignId).toBe(desktop.savedDesignId);
});

it("connects the mobile share entry to the received saved model identity", () => {
  const shares = propsAt("components/mobile/MobileShell.tsx", "ShareDesignButton");
  expect(shares).toHaveLength(1);
  expect(shares[0]).toMatchObject({
    savedDesignId: "{props.currentDesignId}",
    savedRevision: "{props.savedRevision}",
    hasUnsavedChanges: "{props.hasUnsavedChanges}",
  });
});
