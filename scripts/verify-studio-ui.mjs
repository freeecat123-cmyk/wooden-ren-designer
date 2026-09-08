import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

const base = process.argv[2] ?? "http://127.0.0.1:3120";
const browser = await chromium.launch();
const report = [];
try {
  for (const locale of (process.env.STUDIO_LOCALES ?? "zh-TW,en").split(",")) {
    const context = await browser.newContext();
    for (const width of (process.env.STUDIO_WIDTHS ?? "1440,1280,768,390,360").split(",").map(Number)) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
      await page.goto(`${base}${locale === "en" ? "/en" : ""}/design/workbench`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const canvas = page.locator("canvas");
      await canvas.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector("canvas");
        return canvas && canvas.width > 100 && canvas.height > 100;
      });
      // Canvas mounting precedes asynchronous geometry and texture uploads.
      let before;
      let wood = 0;
      const paintDeadline = Date.now() + 60000;
      do {
        before = await canvas.screenshot();
        const { data, info } = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        wood = 0;
        for (let i = 0; i < data.length; i += info.channels) if (data[i] > data[i + 2] + 12 && data[i + 1] > data[i + 2] + 5) wood++;
        if (wood > 300) break;
        await page.waitForTimeout(200);
      } while (Date.now() < paintDeadline);
      if (wood <= 300) await page.screenshot({ path: `/tmp/studio-failed-${locale}-${width}.png` });
      assert(wood > 300, `${locale}/${width}: no visible wood (${wood} pixels)`);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55, { steps: 12 });
      await page.mouse.up();
      const after = await canvas.screenshot();
      assert(!before.equals(after), `${locale}/${width}: rotation did not repaint`);
      const primary = await canvas.elementHandle();
      assert.equal(await canvas.count(), 1);
      assert.equal(await page.locator("form[data-design-form]").count(), 1);
      for (const name of locale === "en" ? ["Drawings", "Materials", "Build", "Quote", "Design"] : ["圖面", "材料", "製作", "報價", "設計"]) {
        console.error(`${locale}/${width}: opening ${name}`);
        await page.getByRole("tab", { name, exact: true }).click();
        await page.waitForFunction(label => Array.from(document.querySelectorAll('[role="tab"]'))
          .some(tab => tab.textContent === label && tab.getAttribute("aria-selected") === "true"), name);
      }
      await canvas.waitFor({ state: "visible" });
      assert(await primary.evaluate(node => node === document.querySelector("canvas")));
      const trigger = page.getByRole("button", { name: locale === "en" ? "Toggle parameters" : "切換參數面板", exact: true });
      if (width < 768) await trigger.click();
      const parameterPanel = page.locator('[data-studio-panel="parameters"]');
      assert(await parameterPanel.isVisible());
      if (locale === "zh-TW") {
        const length = parameterPanel.locator('input[name="length"]').first();
        await length.fill("1700");
        await length.blur();
        await page.waitForFunction(() => JSON.parse(document.querySelector('form[data-design-form]').dataset.designBaseline).length === 1700);
        assert.equal(await length.inputValue(), "1700");
      }
      if (width < 768) {
        await page.keyboard.press("Escape");
        assert(await trigger.evaluate(node => node === document.activeElement));
      }
      await page.screenshot({ path: `/tmp/studio-live-${locale}-${width}.png` });
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        elements: Array.from(document.querySelectorAll("body *")).filter(el => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 15).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })) }));
      assert(overflow.scroll <= overflow.width, `${locale}/${width}: overflow ${JSON.stringify(overflow)}`);
      assert.deepEqual(errors, [], `${locale}/${width}: browser errors`);
      report.push({ locale, width, woodPixels: wood, canvas: "nonblank, rotating, preserved", forms: 1 });
      console.error(`${locale}/${width}: passed`);
      await page.close();
    }
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
