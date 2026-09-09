import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { beforeAll, afterAll, expect, it } from "vitest";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {StudioActionGuard} from './components/design/StudioActionGuard';
    import {announceDesignNavigation} from './lib/design/navigation-pending';
    window.announceDesignNavigation = announceDesignNavigation;
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

/**
 * 回歸：2026-09-09「裁切計算器按了沒反應」。
 *
 * Next 的 server searchParams **會丟掉空值參數**（正式站實測：`?joineryMode=&length=350`
 * 到 server 手上只剩 `length=350`）。而設計表單的「組裝版」radio value 就是空字串，
 * 每次推 URL 都會帶一個 `joineryMode=`。
 *
 * 兩邊的鍵因此永遠對不起來 → navigationPending 卡在 true → 材料單 / 裁切計算器 /
 * 列印 / 報價 / 儲存的點擊全部被 preventDefault，而且不會自己好。
 */
it("survives Next dropping blank search params: blank joineryMode must not wedge the guard", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "Export" }).waitFor();
    // client 推出去的網址帶著空值的 joineryMode（組裝版 radio）
    await page.evaluate(() => (window as any).announceDesignNavigation("https://studio.test/design/stool?joineryMode=&length=300"));
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBeUndefined();
    // server 重新 render，但它收到的 searchParams 已經沒有 joineryMode 了
    await page.evaluate(() => (window as any).renderGuard("length=300"));
    await page.getByRole("button", { name: "Export" }).click();
    expect(await page.evaluate(() => (window as any).executed)).toBe(1);
  } finally { await page.close(); }
});
