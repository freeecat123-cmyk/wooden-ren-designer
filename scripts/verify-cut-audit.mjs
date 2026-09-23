import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const origin = process.argv[2] ?? "http://localhost:3114";
const browser = await chromium.launch();
try {
  for (const [name, context] of [
    ["desktop", { viewport: { width: 1440, height: 1000 } }],
    ["mobile", devices["iPhone 13"]],
  ]) {
    const page = await browser.newPage(context);
    const audit = [];
    const errors = [];
    page.on("console", message => {
      if (message.text().includes("[audit=true]")) audit.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${origin}/design/wine-rack?audit=true`);
    await page.waitForFunction(() => [...document.querySelectorAll("canvas")].some(c => c.width > 300));
    await page.waitForTimeout(2000);
    const canvases = page.locator("canvas:visible");
    let canvas;
    let largest = 0;
    for (let i = 0; i < await canvases.count(); i++) {
      const candidate = canvases.nth(i);
      const box = await candidate.boundingBox();
      if (box && box.width * box.height > largest) {
        canvas = candidate;
        largest = box.width * box.height;
      }
    }
    assert.ok(canvas && largest > 20000, "visible model canvas");
    await canvas.scrollIntoViewIfNeeded();
    const first = await canvas.screenshot();
    const stats = await sharp(first).stats();
    assert.ok(stats.channels.slice(0, 3).every(c => c.stdev > 8), "model canvas is not blank");
    assert.ok(audit.includes("[audit=true] 0 overlaps"), audit.join("\n"));
    assert.ok(audit.every(line => line === "[audit=true] 0 overlaps"), audit.join("\n"));
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const second = await canvas.screenshot();
    const before = await sharp(first).resize(128, 128).removeAlpha().raw().toBuffer();
    const after = await sharp(second).resize(128, 128).removeAlpha().raw().toBuffer();
    const delta = before.reduce((sum, pixel, i) => sum + Math.abs(pixel - after[i]), 0) / before.length;
    assert.ok(delta > 1, `rotation must change canvas pixels: ${delta}`);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `/tmp/cut-audit-${name}.png` });
    console.log(`${name}: zero audit warnings, nonblank canvas, rotation pixel delta ${delta.toFixed(2)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
