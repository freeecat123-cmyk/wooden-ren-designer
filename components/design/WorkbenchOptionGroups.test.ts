import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { workbenchOptions } from "@/lib/templates/workbench";
import { WorkbenchOptionGroups } from "./WorkbenchOptionGroups";

it("renders every field once, keeping collapsed controls mounted and enabled", () => {
  const html = renderToStaticMarkup(createElement(WorkbenchOptionGroups, {
    specs: workbenchOptions,
    locale: "en",
    renderField: (spec) => createElement("input", { name: spec.key, defaultValue: String(spec.defaultValue) }),
  }));
  expect(html.match(/<details/g)).toHaveLength(6);
  expect(html.match(/ open=""/g)).toHaveLength(1);
  expect(html).not.toContain("disabled");
  for (const spec of workbenchOptions) expect(html.split(`name="${spec.key}"`)).toHaveLength(2);
  expect(html).toContain("Dimensions / Structure");
  expect(html).toContain("min-h-[44px]");
});
