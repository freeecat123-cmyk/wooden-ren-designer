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

it("uses a single verified share control in the responsive studio", () => {
  const path = "app/[locale]/design/[type]/page.tsx";
  const shares = propsAt(path, "ShareDesignButton");
  expect(shares).toHaveLength(1);
  expect(propsAt(path, "MobileShell")).toHaveLength(0);
  expect(propsAt(path, "DesignStudio")).toHaveLength(1);
  expect(shares[0]).toMatchObject({
    savedDesignId: "{currentDesignId}",
    savedRevision: '{frozen && typeof sp.revision === "string" ? sp.revision : null}',
    hasUnsavedChanges: "{!frozen}",
  });
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
