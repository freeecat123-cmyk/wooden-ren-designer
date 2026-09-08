import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { beforeAll, afterAll, expect, it } from "vitest";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {StudioActionGuard} from './components/design/StudioActionGuard';
    const root = createRoot(document.getElementById('root'));
    window.renderGuard = (resolvedSearch='') => root.render(<StudioActionGuard locale="en" resolvedSearch={resolvedSearch}>
      <form data-design-form data-design-baseline={JSON.stringify({length:100, checked:true, style:'b'})}><input name="length" defaultValue="100"/><input name="checked" type="checkbox" defaultChecked />
      <select name="style" defaultValue="b"><option value="a">A</option><option value="b">B</option></select></form>
      <button data-studio-output onClick={()=>window.executed=(window.executed||0)+1}>Export</button>
    </StudioActionGuard>);
    window.renderGuard();
    document.addEventListener('wooden-ren:flush-design',()=>window.flushed=true);
  ` }, bundle: true, write: false, platform: "browser", jsx: "automatic" });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => browser?.close());

it("blocks stale output while flushing pending form input, then allows the original state", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle });
    await page.locator('input[name="length"]').fill("200");
    await page.locator('input[name="length"]').evaluate((el: HTMLInputElement) => { el.defaultValue = "200"; });
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBeUndefined();
    expect(await page.evaluate(() => (window as any).flushed)).toBe(true);
    await page.locator('input[name="length"]').fill("100");
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("wooden-ren:design-navigation", { detail: { search: "length=300" } })));
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("wooden-ren:design-navigation", { detail: { search: "" } })));
    await page.locator('input[type="checkbox"]').uncheck();
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(1);
    await page.locator('input[type="checkbox"]').evaluate(el => {
      const fieldset = document.createElement("fieldset"); fieldset.disabled = true;
      el.before(fieldset); fieldset.appendChild(el);
    });
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(2);
  } finally { await page.close(); }
});

it("clears completed preset navigation before a later save changes only the revision", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "Export" }).waitFor();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("wooden-ren:design-navigation", { detail: { search: "length=300" } })));
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBeUndefined();
    await page.evaluate(() => (window as any).renderGuard("length=300"));
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(1);
    await page.evaluate(() => (window as any).renderGuard("length=300&revision=new"));
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(2);
  } finally { await page.close(); }
});
