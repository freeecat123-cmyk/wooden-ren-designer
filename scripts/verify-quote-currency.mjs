import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.argv[2] ?? "http://localhost:3113";
const browser = await chromium.launch();
try {
  for (const [prefix, cookie, expected] of [["", "USD", "TWD"], ["/en", "TWD", "USD"]]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: "wr-currency", value: cookie, url: origin }]);
    const page = await context.newPage();
    await page.goto(`${origin}${prefix}/design/tea-table/quote/print?length=500&width=350&height=400&depositRate=0.5`);
    await page.getByRole("button", { name: /Print \/ Save|列印 \/ 存成/ }).waitFor();
    // Hydration is necessary: the original defect was server totals vs client terms.
    if (expected === "TWD") await page.waitForFunction(() => document.body.innerText.includes("50%"));
    else await page.getByRole("main").getByText(/^Estimated material cost$/i).waitFor();
    const body = await page.locator("body").innerText();
    const currencyNote = body.includes("USD amounts converted from TWD");
    if (expected === "TWD") assert.equal(currencyNote, false);
    const amounts = [...body.matchAll(/\$[\d,]+(?:\.\d{2})?/g)].map(m => m[0]);
    assert.ok(amounts.length >= (expected === "TWD" ? 5 : 1), "quote must contain money");
    const decimalAmounts = amounts.filter(v => v.includes("."));
    if (expected === "TWD") assert.equal(decimalAmounts.length, 0, "Chinese quote must not contain converted USD totals");
    else assert.ok(decimalAmounts.length >= 1, "English DIY material estimate must convert to USD");
    await page.screenshot({ path: `/tmp/phase-one-quote-${expected}.png`, fullPage: true });
    console.log(`${expected}: stale ${cookie} cookie ignored; ${expected === "TWD" ? "server quote and hydrated terms agree" : "DIY material estimate retains USD"}`);
    await context.close();
  }
} finally { await browser.close(); }
