import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";

/*
 * 輸出區在手機上展開約 380px，把 3D 和材料表都擠掉 —— 木頭仁 2026-09-09
 * 「輸出的部分可以折疊嗎」。這支守的是折疊本身的三件事：
 * 預設收合、點得開、以及展開狀態要記得住（不然每次切分頁都要重點一次）。
 */
let browser: Browser;
let script: string;

beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import CollapsibleExports from './components/design/CollapsibleExports';
      createRoot(document.getElementById('root')).render(
        <div data-studio-model>
          <CollapsibleExports label="輸出檔案"><button>STL</button></CollapsibleExports>
        </div>
      );
    ` },
    bundle: true, write: false, outdir: "exports-browser-test", platform: "browser", jsx: "automatic",
  });
  script = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

async function open(storage?: string) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(5000);
  page.on("pageerror", error => console.error("PAGEERROR:", error.message));
  page.on("console", message => { if (message.type() === "error") console.error("CONSOLE:", message.text()); });
  await page.route("http://exports.test/**", route => route.fulfill({
    contentType: "text/html", body: '<html><body style="margin:0"><div id="root"></div></body></html>',
  }));
  await page.goto("http://exports.test/");
  // 同一顆瀏覽器的分頁共用 localStorage ⇒ 每支測試都要自己清，不然會吃到前一支留下的值。
  await page.evaluate(v => {
    if (v === null) localStorage.removeItem("studio-exports-open");
    else localStorage.setItem("studio-exports-open", v);
  }, storage ?? null);
  await page.addScriptTag({ content: script });
  await page.locator("[data-studio-exports]").waitFor();
  // DOM 出現 ≠ effect 跑完。監聽器是在 effect 裡掛的，太早點會什麼都不記。
  await page.waitForFunction(() => document.querySelector("[data-exports-caret]") !== null);
  await page.waitForTimeout(150);
  return page;
}

/*
 * ⚠️ 守的是「mount 之後」的狀態，不是 SSR 首屏。變異測試顯示：在 <details> 上直接寫
 *    `open`，effect 還是會把它蓋回收合 ⇒ 那個變異抓不到（實測 4 支全綠）。真正抓得到
 *    的是把 effect 裡的 `details.open = saved` 改成 `= true`（4 支全紅）。
 */
it("預設是收合的，而且收合時輸出按鈕量不到高度", async () => {
  const page = await open();
  const details = page.locator("[data-studio-exports]");
  expect(await details.evaluate(node => node.tagName)).toBe("DETAILS");
  expect(await details.evaluate(node => node.hasAttribute("open"))).toBe(false);
  expect(await page.locator("[data-studio-exports] button").isVisible()).toBe(false);
  await page.close();
});

it("點標題就展開，按鈕露出來", async () => {
  const page = await open();
  await page.locator("[data-studio-exports] > summary").click();
  expect(await page.locator("[data-studio-exports]").evaluate(node => node.hasAttribute("open"))).toBe(true);
  expect(await page.locator("[data-studio-exports] button").isVisible()).toBe(true);
  await page.close();
});

it("展開過就記住，重新載入還是展開的", async () => {
  const page = await open();
  await page.locator("[data-studio-exports] > summary").click();
  /* <details> 的 toggle 事件是排進佇列非同步派發的，點完立刻讀會拿到還沒寫入的值。 */
  await page.waitForFunction(() => localStorage.getItem("studio-exports-open") === "1");
  expect(await page.evaluate(() => localStorage.getItem("studio-exports-open"))).toBe("1");
  await page.close();

  const again = await open("1");
  expect(await again.locator("[data-studio-exports]").evaluate(node => node.hasAttribute("open"))).toBe(true);
  await again.close();
});

it("收起來也記住，不會下次又自己打開", async () => {
  const page = await open("1");
  await page.locator("[data-studio-exports] > summary").click();
  await page.waitForFunction(() => localStorage.getItem("studio-exports-open") === "0");
  expect(await page.evaluate(() => localStorage.getItem("studio-exports-open"))).toBe("0");
  await page.close();

  const again = await open("0");
  expect(await again.locator("[data-studio-exports]").evaluate(node => node.hasAttribute("open"))).toBe(false);
  await again.close();
});
