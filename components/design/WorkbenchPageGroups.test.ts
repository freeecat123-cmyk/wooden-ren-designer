import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";
import { workbenchOptions } from "@/lib/templates/workbench";
import * as groups from "@/lib/design/option-groups";
import { WorkbenchOptionGroups } from "./WorkbenchOptionGroups";

// Exercise the private page renderer without loading auth, database or the 3D route.
const source = ts.createSourceFile("page.tsx", readFileSync("app/[locale]/design/[type]/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = source.statements.filter((node) => ts.isFunctionDeclaration(node) && ["GroupedOptionFields", "isVisible", "evalDep"].includes(node.name?.text ?? ""));
const compiled = ts.transpileModule(functions.map((node) => node.getText(source)).join("\n"), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
const renderGroups = new Function("React", "WorkbenchOptionGroups", "OptionField", "GROUP_META", "GROUP_ORDER", "groupLabel", `${compiled}; return GroupedOptionFields;`)(
  React, WorkbenchOptionGroups,
  ({ spec, value }: { spec: { key: string }; value: unknown }) => React.createElement("input", { name: spec.key, defaultValue: String(value) }),
  groups.GROUP_META, groups.GROUP_ORDER, groups.groupLabel,
);
const values = Object.fromEntries(workbenchOptions.map((s) => [s.key, s.defaultValue]));
const render = (category: string, joineryMode = false) => renderToStaticMarkup(renderGroups({
  category, optionSchema: workbenchOptions, optionValues: values, joineryMode, locale: "en",
}));

it("routes workbench to purpose groups after existing dependency and joinery filtering", () => {
  const html = render("workbench");
  expect(html).toContain("data-workbench-groups");
  expect(html.match(/data-workbench-group="/g)).toHaveLength(6);
  expect(html.split('name="constructionVersion"')).toHaveLength(2);
  expect(html).toContain('type="hidden" name="plyTopLayers"');
  expect(html).toContain('type="hidden" name="legPenetratingTenon"');
  expect(render("workbench", true)).toContain('name="legPenetratingTenon"');
});

it("preserves every hidden value exactly once without duplicating visible controls", () => {
  const optionValues = { ...values, gapWidth: 70, topSplit: "none", retainedFalse: false, retainedZero: 0, retainedEmpty: "" };
  const html = renderToStaticMarkup(renderGroups({
    category: "workbench", optionSchema: workbenchOptions, optionValues, joineryMode: false, locale: "en",
  }));
  for (const key of Object.keys(optionValues)) {
    expect(html.split(`name="${key}"`), key).toHaveLength(2);
  }
  expect(html).toContain('type="hidden" name="gapWidth" value="70"');
  expect(html).toContain('type="hidden" name="retainedFalse" value="false"');
  expect(html).toContain('type="hidden" name="retainedZero" value="0"');
  expect(html).toContain('type="hidden" name="retainedEmpty" value=""');
});

it("retains the existing renderer for other furniture", () => {
  expect(render("table")).not.toContain("data-workbench-groups");
  expect(render("table")).toContain("Workholding");
});
