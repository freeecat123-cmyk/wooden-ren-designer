import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, devices, type Browser, type Page } from "playwright";
import { readFile } from "node:fs/promises";
import { compile } from "@tailwindcss/node";

let browser: Browser;
let bundle: string;
let css: string;
beforeAll(async () => {
  const styleSources = await Promise.all([
    "components/design/WorkbenchOptionGroups.tsx", "components/mobile/AdvancedSheet.tsx",
    "components/mobile/MobileOptionField.tsx", "components/mobile/RangeInput.tsx",
  ].map((path) => readFile(path, "utf8")));
  const compiler = await compile(await readFile("app/globals.css", "utf8"), { base: process.cwd(), onDependency() {} });
  css = compiler.build(styleSources.join(" ").split(/[\s"'`{}]+/));
  const result = await build({
    stdin: { contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {DesignFormShell} from './components/design/DesignFormShell';
      import {WorkbenchOptionGroups} from './components/design/WorkbenchOptionGroups';
      import {workbenchOptions} from './lib/templates/workbench';
      import {AdvancedSheet} from './components/mobile/AdvancedSheet';
      import {MobileOptionField} from './components/mobile/MobileOptionField';
      import {NextIntlClientProvider} from 'next-intl';
      import messages from './messages/zh-TW.json';
      const values = Object.fromEntries(workbenchOptions.map(s => [s.key, s.defaultValue]));
      const form = (
        <DesignFormShell action='/design/workbench'>
          <input name='height' defaultValue='830'/>
          <input type='hidden' name='retained' value='unchanged'/>
          <WorkbenchOptionGroups specs={workbenchOptions} locale='en' mobile={window.sheetFields} renderField={s =>
            window.sheetFields ? <MobileOptionField spec={s} value={s.defaultValue} allValues={values}/>
            : s.type === 'select' ? (window.mobileFields ? <fieldset>{s.choices.map(c => <label key={String(c.value)}><input type='radio' name={s.key} value={String(c.value)} defaultChecked={c.value === s.defaultValue}/>{c.label}</label>)}</fieldset> : <select name={s.key} defaultValue={String(s.defaultValue)}>{s.choices.map(c => <option key={String(c.value)} value={String(c.value)}>{c.label}</option>)}</select>)
            : <input name={s.key} type={s.type === 'checkbox' ? 'checkbox' : 'number'} defaultChecked={s.type === 'checkbox' ? s.defaultValue : undefined} defaultValue={s.type === 'checkbox' ? 'true' : String(s.defaultValue)}/>
          }/>
        </DesignFormShell>
      );
      createRoot(document.getElementById('root')).render(window.sheetFields
        ? <NextIntlClientProvider locale='zh-TW' messages={messages}><AdvancedSheet open onClose={()=>{}} structureContent={form} styleContent={null} joineryContent={null} sceneContent={null}/></NextIntlClientProvider>
        : form);
      `, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "navigation-test-boundary", setup(b) {
      b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "test" }));
      b.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
        export const useSearchParams = () => new URLSearchParams('designId=saved-id&revision=4&scene=studio&wf=true');
        export const useRouter = () => ({replace: (url, options) => {window.navigationResult = {url, options};}});
      ` }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

async function mount(mobileFields = false, sheetFields = false) {
  const page = await browser.newPage({ ...devices["iPhone 13"] });
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("http://workbench.test/", (route) => route.fulfill({ contentType: "text/html", body: '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>' }));
  await page.goto("http://workbench.test/");
  await page.evaluate((mobile) => { (window as unknown as { mobileFields: boolean }).mobileFields = mobile; }, mobileFields);
  await page.evaluate((sheet) => { (window as unknown as { sheetFields: boolean }).sheetFields = sheet; }, sheetFields);
  if (sheetFields) await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  try {
    await page.locator('input[name="height"]').waitFor();
  } catch (error) {
    await page.close();
    throw new Error(errors.join("\n") || String(error));
  }
  return page;
}
async function submitted(page: Page) {
  await page.waitForFunction(() => Boolean((window as unknown as { navigationResult: unknown }).navigationResult));
  return page.evaluate(() => (window as unknown as { navigationResult: { url: string; options: { scroll: boolean } } }).navigationResult);
}

it("collapsed fields remain successful controls and toggling groups does not dirty the URL", async () => {
  const page = await mount();
  try {
    await page.locator('[data-workbench-group="base"] summary').click();
    await page.locator('[data-workbench-group="base"] summary').click();
    expect(await page.evaluate(() => (window as unknown as { navigationResult?: unknown }).navigationResult)).toBeUndefined();
    const data = await page.locator('form').evaluate((form) => Object.fromEntries(new FormData(form as HTMLFormElement)));
    expect(data.legSize).toBe("100");
    expect(data.designId).toBe("saved-id");
    expect(data.revision).toBe("4");
  } finally { await page.close(); }
});

it("iPhone 13 sheet groups and controls are tappable and not occluded", async () => {
  const page = await mount(false, true);
  try {
    expect(await page.evaluate(() => window.innerWidth)).toBe(390);
    for (const group of ["structure", "top", "base", "vises", "storage", "machining"]) {
      const details = page.locator(`[data-workbench-group="${group}"]`);
      const summary = details.locator("summary");
      await summary.evaluate((el) => el.scrollIntoView({ block: "center" }));
      expect(await summary.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
      if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) await summary.click();
      for (const control of await details.locator('label:has(input), input[type="number"]:not([aria-hidden="true"]), input[type="range"]').all()) {
        await control.evaluate((el) => el.scrollIntoView({ block: "center" }));
        const hit = await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { clear: r.left >= 0 && r.right <= window.innerWidth && el.contains(top), control: el.outerHTML.slice(0, 300), top: top?.outerHTML.slice(0, 300), rect: r.toJSON() };
        });
        expect(hit.clear, JSON.stringify(hit)).toBe(true);
      }
    }
    const choice = page.locator('input[name="dogHoles"][value="none"]').locator("..");
    await choice.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await choice.click();
    expect(new URL((await submitted(page)).url, "http://local").searchParams.get("dogHoles")).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    while (await page.locator('details[open] summary').count()) {
      const summary = page.locator('details[open] summary').first();
      await summary.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await summary.click();
    }
    await page.locator('[data-workbench-group="structure"] summary').evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: "/tmp/workbench-iphone13-fixture.png" });
  } finally { await page.close(); }
}, 30000);

it("preset updates inputs in collapsed groups and preserves saved identity and scene", async () => {
  const page = await mount();
  try {
    await page.locator('select[name="benchStyle"]').selectOption("apron");
    const result = await submitted(page);
    const params = new URL(result.url, "http://local").searchParams;
    expect(params.get("benchStyle")).toBe("apron");
    expect(params.get("withApron")).toBe("true");
    expect(params.get("topThickness")).toBe("65");
    expect(params.get("retained")).toBe("unchanged");
    expect(params.get("designId")).toBe("saved-id");
    expect(params.get("revision")).toBe("4");
    expect(params.get("constructionVersion")).toBe("1");
    expect(params.get("wf")).toBe("true");
    expect(params.get("scene")).toBe("studio");
    expect(result.options.scroll).toBe(false);
  } finally { await page.close(); }
});

it("mobile radio preset updates collapsed radios and version remains reachable", async () => {
  const page = await mount(true);
  try {
    await page.locator('input[name="constructionVersion"][value="2"]').check();
    await page.locator('input[name="benchStyle"][value="mft"]').check();
    const params = new URL((await submitted(page)).url, "http://local").searchParams;
    expect(params.get("constructionVersion")).toBe("2");
    expect(params.get("dogHoles")).toBe("grid");
    expect(params.get("dogHoleDia")).toBe("20");
    expect(params.get("frontVise")).toBe("none");
    expect(params.get("holdfastHoles")).toBe("false");
  } finally { await page.close(); }
});

it("unchecked default-true checkbox serializes false and numeric blur commits", async () => {
  const page = await mount();
  try {
    await page.locator('[data-workbench-group="base"] summary').click();
    await page.locator('input[name="withLowerStretchers"]').uncheck();
    expect(new URL((await submitted(page)).url, "http://local").searchParams.get("withLowerStretchers")).toBe("false");
    await page.locator('input[name="legSize"]').fill("110");
    await page.locator('input[name="legSize"]').press("Tab");
    await page.waitForFunction(() => (window as unknown as { navigationResult: { url: string } }).navigationResult.url.includes("legSize=110"));
  } finally { await page.close(); }
});
