import { readFileSync } from "node:fs";
import ts from "typescript";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";
import { WORKBENCH_PRESETS, workbenchPresetValues } from "@/lib/templates/workbench-presets";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  // Isolate the real private page renderer from server auth/database dependencies.
  const source = ts.createSourceFile("page.tsx", readFileSync("app/[locale]/design/[type]/page.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node)
    && ["GroupedOptionFields", "isVisible", "evalDep"].includes(node.name?.text ?? ""));
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {DesignFormShell} from './components/design/DesignFormShell';
      import {WorkbenchOptionGroups} from './components/design/WorkbenchOptionGroups';
      import {workbenchOptions} from './lib/templates/workbench';
      ${functions.map(node => node.getText(source)).join("\n")}
      // Only the leaf presentation is replaced; dependencies, groups and submit/preset logic are real.
      function OptionField({spec, value}) {
        return spec.type === 'select'
          ? <select name={spec.key} defaultValue={String(value)}>{spec.choices.map(c => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}</select>
          : <input name={spec.key} type={spec.type === 'checkbox' ? 'checkbox' : 'number'} defaultChecked={spec.type === 'checkbox' ? value : undefined} defaultValue={spec.type === 'checkbox' ? 'true' : String(value)}/>;
      }
      const root = createRoot(document.getElementById('root'));
      let values = Object.fromEntries(workbenchOptions.map(s => [s.key, s.defaultValue]));
      Object.assign(values, {constructionVersion: '2', topSplit: 'gap', gapWidth: 70});
      window.renderOptions = (query) => {
        if (query) {
          const params = new URL(query, 'http://fixture.test').searchParams;
          values = Object.fromEntries(workbenchOptions.map(s => {
            const raw = params.get(s.key);
            return [s.key, raw === null ? s.defaultValue : s.type === 'checkbox' ? raw === 'true' : s.type === 'number' ? Number(raw) : raw];
          }));
        }
        root.render(<DesignFormShell action='/design/workbench'>
          <GroupedOptionFields category='workbench' optionSchema={workbenchOptions} optionValues={values} joineryMode={false} locale='en'/>
        </DesignFormShell>);
      };
      window.renderOptions();
    ` },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "navigation-boundary", setup(b) {
      b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "test" }));
      b.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
        export const useSearchParams = () => new URLSearchParams('designId=fixture&revision=4&scene=studio');
        export const useRouter = () => ({replace: url => { window.submitted = url; }});
      ` }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

async function mount() {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route("http://fixture.test/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("http://fixture.test/");
  await page.addScriptTag({ content: bundle });
  await page.locator('select[name="benchStyle"]').waitFor();
  return page;
}

async function choose(page: Page, key: string, value: string) {
  await page.evaluate(() => { (window as unknown as { submitted?: string }).submitted = undefined; });
  const select = page.locator(`select[name="${key}"]`);
  await select.evaluate(el => { el.closest("details")!.open = true; });
  await select.selectOption(value);
  await page.waitForFunction(() => Boolean((window as unknown as { submitted?: string }).submitted));
  return page.evaluate(() => (window as unknown as { submitted: string }).submitted);
}

it.each(Object.keys(WORKBENCH_PRESETS))("desktop %s preset serializes every preset field, including hidden dependencies", async style => {
  const page = await mount();
  try {
    // Starting from a different style also exercises the reset-to-default preset.
    if (style === "roubo") await choose(page, "benchStyle", "mft");
    const params = new URL(await choose(page, "benchStyle", style), "http://fixture.test").searchParams;
    for (const [key, value] of Object.entries(workbenchPresetValues(style))) {
      expect(params.getAll(key), key).toEqual([String(value)]);
    }
    expect(params.get("constructionVersion")).toBe("2");
    expect(params.get("designId")).toBe("fixture");
    expect(params.get("revision")).toBe("4");
    expect(params.get("scene")).toBe("studio");
  } finally { await page.close(); }
});

it("desktop hidden gap survives another section edit and becomes visible with its original value", async () => {
  const page = await mount();
  try {
    let query = await choose(page, "topSplit", "none");
    await page.evaluate(query => (window as unknown as { renderOptions: (q: string) => void }).renderOptions(query), query);
    await page.locator('input[type="hidden"][name="gapWidth"]').waitFor({ state: "attached" });
    query = await choose(page, "frontVise", "none");
    expect(new URL(query, "http://fixture.test").searchParams.getAll("gapWidth")).toEqual(["70"]);
    await page.evaluate(query => (window as unknown as { renderOptions: (q: string) => void }).renderOptions(query), query);
    query = await choose(page, "topSplit", "gap");
    await page.evaluate(query => (window as unknown as { renderOptions: (q: string) => void }).renderOptions(query), query);
    await page.locator('input[name="gapWidth"]:not([type="hidden"])').waitFor({ state: "attached" });
    expect(await page.locator('input[name="gapWidth"]').inputValue()).toBe("70");
    expect(await page.locator('[name="gapWidth"]').count()).toBe(1);
  } finally { await page.close(); }
});
