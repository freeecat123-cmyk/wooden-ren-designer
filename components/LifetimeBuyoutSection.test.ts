import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";

// 跟 SaveDesignButton.test.ts 同做法：把元件打包後丟進真的 chromium 跑。
// 全套平行時同時開很多 chromium，預設 5 秒不夠。
vi.setConfig({ testTimeout: 30000 });

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "tsx",
      contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {LifetimeBuyoutSection} from './components/LifetimeBuyoutSection';
        createRoot(document.getElementById('root')).render(<LifetimeBuyoutSection/>);
      `,
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    plugins: [
      {
        name: "lifetime-stubs",
        setup(b) {
          const stubs: Record<string, string> = {
            // 翻譯 key 原樣顯示，帶參數時附上參數，方便斷言「剩幾個名額」這類動態字
            "next-intl": `export const useTranslations=()=>{const t=(k,v)=>v?k+'|'+JSON.stringify(v):k;t.raw=()=>['feat-a','feat-b'];return t;};`,
            "next/navigation": `export const useSearchParams=()=>new URLSearchParams(location.search);`,
            "@/hooks/useUserPlan": `export const useUserPlan=()=>window.__userPlan;`,
          };
          b.onResolve({ filter: /.*/ }, (args) =>
            args.path in stubs ? { path: args.path, namespace: "lifetime-test" } : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: "lifetime-test" }, (args) => ({ contents: stubs[args.path] }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => {
  await browser?.close();
});

type Plan = "free" | "personal" | "pro" | "lifetime" | "lifetime_personal";

async function mount(opts: {
  api: { status: number; body: unknown };
  plan?: Plan;
  loggedIn?: boolean;
  query?: string;
}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route("http://pricing.test/**", (route) => {
    const url = route.request().url();
    if (url.includes("/api/lifetime/status")) {
      return route.fulfill({
        status: opts.api.status,
        contentType: "application/json",
        body: JSON.stringify(opts.api.body),
      });
    }
    return route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' });
  });
  await page.goto(`http://pricing.test/pricing${opts.query ?? ""}`);
  await page.evaluate(
    ({ plan, loggedIn }) => {
      (window as unknown as Record<string, unknown>).__userPlan = {
        plan,
        isLoggedIn: loggedIn,
        isLoading: false,
      };
    },
    { plan: opts.plan ?? "free", loggedIn: opts.loggedIn ?? true },
  );
  await page.addScriptTag({ content: bundle });
  return page;
}

const AVAILABLE = { price: 6900, quota: 50, remaining: 12, available: true };
const SOLD_OUT = { price: 6900, quota: 50, remaining: 0, available: false };
const buyForm = 'form[action="/api/checkout/lifetime"]';

describe("pricing 頁的終身買斷區塊", () => {
  it("有名額 + 免費版登入：顯示價格、剩餘名額與購買鈕（送到 /api/checkout/lifetime）", async () => {
    const page = await mount({ api: { status: 200, body: AVAILABLE } });
    try {
      await page.locator(buyForm).waitFor();
      const text = await page.locator("#root").innerText();
      expect(text).toContain('"price":"6,900"'); // t("price", {price})
      expect(text).toContain('"remaining":12');
      expect(text).toContain('"quota":50');
      expect(await page.locator(`${buyForm} button[type=submit]`).count()).toBe(1);
      expect(text).not.toContain("soldOutTitle");
    } finally {
      await page.close();
    }
  });

  it("額滿：顯示「已額滿」，而且不再有任何購買表單", async () => {
    const page = await mount({ api: { status: 200, body: SOLD_OUT } });
    try {
      await page.getByText("soldOutTitle").waitFor();
      expect(await page.locator(buyForm).count()).toBe(0);
      expect(await page.locator("form").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("讀不到名額（API 503）：整塊不顯示，不會在不確定時開放購買", async () => {
    const page = await mount({ api: { status: 503, body: { error: "unavailable" } } });
    try {
      await page.waitForTimeout(400);
      expect(await page.locator("#root").innerHTML()).toBe("");
    } finally {
      await page.close();
    }
  });

  it("已有專業版訂閱：看到說明、沒有購買鈕（不動既有訂閱用戶）", async () => {
    const page = await mount({ api: { status: 200, body: AVAILABLE }, plan: "pro" });
    try {
      await page.getByText("hasPlan").waitFor();
      expect(await page.locator("form").count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("已經是終身會員：顯示「已擁有」，沒有購買鈕", async () => {
    for (const plan of ["lifetime", "lifetime_personal"] as const) {
      const page = await mount({ api: { status: 200, body: AVAILABLE }, plan });
      try {
        await page.getByText("owned", { exact: true }).waitFor();
        expect(await page.locator("form").count()).toBe(0);
      } finally {
        await page.close();
      }
    }
  });

  it("未登入：仍顯示購買鈕（按下去由伺服器導去登入）", async () => {
    const page = await mount({ api: { status: 200, body: AVAILABLE }, loggedIn: false });
    try {
      await page.locator(buyForm).waitFor();
    } finally {
      await page.close();
    }
  });

  it("結帳被擋後導回的提示（?lifetime_notice=soldout）會顯示", async () => {
    const page = await mount({ api: { status: 200, body: SOLD_OUT }, query: "?lifetime_notice=soldout" });
    try {
      await page.getByText("noticeSoldout").waitFor();
    } finally {
      await page.close();
    }
  });
});
