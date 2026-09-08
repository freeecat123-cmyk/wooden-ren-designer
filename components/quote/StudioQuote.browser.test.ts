import { expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, devices } from "playwright";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { LABOR_DEFAULTS, sanitizeLaborOpts } from "@/lib/pricing/labor";
import { calculateQuote } from "@/lib/pricing/quote";
import { formatMoney, MATERIAL_PRICE_PER_BDFT } from "@/lib/pricing/catalog";
import type { FurnitureDesign } from "@/lib/types";

const design: FurnitureDesign = {
  id: "resolved-snapshot", category: "desk", nameZh: "測試桌",
  overall: { length: 1000, width: 500, thickness: 700 },
  primaryMaterial: "maple", defaultJoinery: "blind-tenon",
  parts: [{ id: "top", nameZh: "桌板", material: "maple", grainDirection: "length",
    visible: { length: 1000, width: 500, thickness: 20 },
    origin: { x: 0, y: 0, z: 0 }, tenons: [], mortises: [] }],
};
const href = "/en/design/desk/quote?designId=owned%2Bmodel&loadSaved=1&revision=7&constructionVersion=2&length=1000&hourlyRate=650&plywoodPricePerBdft=NaN#breakdown";

// Match the existing esbuild + real Chromium component harness; no app route or auth fixture.
it.skipIf(process.env.RUN_STUDIO_QUOTE_BROWSER !== "1")("embedded quote: real costs, sanitized controls, identity, hidden state and locked access", async () => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {NextIntlClientProvider} from 'next-intl';
    import {StudioQuote} from './components/quote/StudioQuote';
    const root=createRoot(document.getElementById('root'));
    const design=${JSON.stringify(design)};
    window.renderQuote=(locale='en',allowed=true,hidden=false,length=1000)=>root.render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        <div hidden={hidden}><StudioQuote locale={locale} allowed={allowed}
          design={{...design,parts:design.parts.map(p=>({...p,visible:{...p.visible,length}}))}}
          quoteHref={${JSON.stringify(href)}.replace('length=1000','length='+length)}/></div>
      </NextIntlClientProvider>);
    window.renderQuote();
  `, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false,
    platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
  const css = await postcss([tailwind()]).process('@import "tailwindcss"; @source "../components/quote/StudioQuote.tsx";', { from: `${process.cwd()}/app/studio-quote-browser.css` });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of ["en", "zh-TW"]) for (const width of [360, 390, 768, 1280, 1440]) {
      const context = await browser.newContext(width < 768 ? { ...devices["iPhone 13"], viewport: { width, height: 844 } } : { viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://studio.test/**", route => route.fulfill({ contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }));
      await page.goto("https://studio.test/");
      await page.addStyleTag({ content: css.css });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(locale => (window as any).renderQuote(locale), locale);
      const currency = locale === "en" ? "USD" : "TWD";
      const opts = { ...LABOR_DEFAULTS, primaryMaterialPricePerBdft: MATERIAL_PRICE_PER_BDFT.maple, hourlyRate: 650 };
      const total = page.getByRole("status", { name: locale === "en" ? "Estimated material cost" : "含稅總計" });
      await total.waitFor({ timeout: 5000 }).catch(error => { throw new Error(`${error}\nBrowser errors: ${errors.join("; ")}`); });
      await page.waitForFunction(expected => document.querySelector('[role="status"]')?.textContent === expected, formatMoney(locale === "en" ? calculateQuote(design, opts).materialCost : calculateQuote(design, opts).total, currency));
      const field = (name: string) => page.locator(`input[name="${name}"]`);
      if (locale === "en") {
        expect(await field("hourlyRate").count()).toBe(0);
        expect(await field("depositRate").count()).toBe(0);
        await field("primaryMaterialPricePerBdft").fill("300");
        await field("primaryMaterialPricePerBdft").blur();
        expect(await total.textContent()).toBe(formatMoney(calculateQuote(design, { ...opts, primaryMaterialPricePerBdft: 300 }).materialCost, currency));
        const target = new URL((await page.locator("a[data-studio-output]").getAttribute("href"))!, "https://studio.test");
        expect(target.searchParams.get("primaryMaterialPricePerBdft")).toBe("300");
        expect(target.searchParams.get("designId")).toBe("owned+model");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/studio-quote-${locale}-${width}.png`, fullPage: true });
        await page.evaluate(() => (window as any).renderQuote("en", false));
        await total.waitFor({ state: "detached" });
        expect(await page.locator("input,table").count()).toBe(0);
        expect(errors).toEqual([]);
        await context.close();
        continue;
      }
      for (const [key, value] of Object.entries({ primaryMaterialPricePerBdft: "300", hourlyRate: "800", equipmentRate: "100", consumables: "300", finishingCost: "2000", hardwareCost: "400", shippingCost: "500", installationCost: "600", quantity: "3", marginRate: "45", vatRate: "5" })) {
        await field(key).fill(value);
      }
      await field("vatRate").blur();
      const changed = sanitizeLaborOpts({ ...opts, primaryMaterialPricePerBdft: 300, hourlyRate: 800, equipmentRate: 100, consumables: 300, finishingCost: 2000, hardwareCost: 400, shippingCost: 500, installationCost: 600, quantity: 3, marginRate: .45, vatRate: .05 });
      const result = calculateQuote(design, changed, locale, locale === "en" ? "inch" : "mm");
      expect(await total.textContent()).toBe(formatMoney(result.total, currency));
      for (const line of result.lines) {
        const row = page.getByRole("row").filter({ has: page.getByText(line.label, { exact: true }) });
        expect(await row.textContent()).toContain(formatMoney(line.amount, currency));
        expect(await row.textContent()).toContain(line.detail);
      }
      const link = page.locator("a[data-studio-output]");
      const outgoing = new URL((await link.getAttribute("href"))!, "https://example.test");
      expect(outgoing.pathname).toBe("/en/design/desk/quote");
      expect(outgoing.hash).toBe("#breakdown");
      for (const key of ["designId", "loadSaved", "revision", "constructionVersion", "length"]) expect(outgoing.searchParams.get(key)).toBe(new URL(href, outgoing).searchParams.get(key));
      for (const [key, value] of Object.entries(changed)) expect(outgoing.searchParams.get(key)).toBe(value == null ? "" : String(value));
      expect(await page.locator("iframe").count()).toBe(0);
      await page.evaluate(locale => (window as any).renderQuote(locale, true, true), locale);
      await page.waitForFunction(() => document.querySelector('#root > div')?.hasAttribute('hidden'));
      await page.evaluate(locale => (window as any).renderQuote(locale, true, false, 1200), locale);
      await total.waitFor();
      expect(await field("quantity").inputValue()).toBe("3");
      const resized = { ...design, parts: design.parts.map(p => ({ ...p, visible: { ...p.visible, length: 1200 } })) };
      expect(await total.textContent()).toBe(formatMoney(calculateQuote(resized, changed).total, currency));
      expect(new URL((await link.getAttribute("href"))!, outgoing).searchParams.get("length")).toBe("1200");
      await field("quantity").fill("-4");
      await field("quantity").blur();
      expect(await field("quantity").inputValue()).toBe("1");
      await field("marginRate").fill("999");
      await field("marginRate").blur();
      expect(await field("marginRate").inputValue()).toBe("80");
      await field("primaryMaterialPricePerBdft").fill("");
      await field("primaryMaterialPricePerBdft").blur();
      expect(await field("primaryMaterialPricePerBdft").inputValue()).toBe(String(MATERIAL_PRICE_PER_BDFT.maple));
      expect(await page.getByRole("alert").count()).toBeGreaterThan(0);
      expect(await total.textContent()).not.toMatch(/NaN|Infinity/);
      await page.locator("summary").click();
      await field("plywoodPricePerBdft").fill("0");
      await field("plywoodPricePerBdft").blur();
      expect(await field("plywoodPricePerBdft").inputValue()).toBe("");
      expect(new URL((await link.getAttribute("href"))!, outgoing).searchParams.get("plywoodPricePerBdft")).toBe("");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `/tmp/studio-quote-${locale}-${width}.png`, fullPage: true });
      await page.evaluate(locale => (window as any).renderQuote(locale, false), locale);
      await total.waitFor({ state: "detached" });
      expect(await page.locator("input,table,a[data-studio-output]").count()).toBe(0);
      expect(errors).toEqual([]);
      await context.close();
    }
  } finally { await browser.close(); }
}, 120000);
