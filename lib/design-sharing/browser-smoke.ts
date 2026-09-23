// Run: npx tsx lib/design-sharing/browser-smoke.ts http://localhost:3115
import assert from "node:assert/strict";
import { chromium, devices } from "playwright";
import sharp from "sharp";
import { build } from "esbuild";
import { photoFrame } from "@/lib/templates/photo-frame";
import { publicGeometry } from "./payload";

async function main() {
  const origin = process.argv[2] ?? "http://localhost:3115";
  const token = "a".repeat(43);
  const payload = publicGeometry(photoFrame({ length: 300, width: 200, height: 25, material: "pine" }), false);
  let styles = "";
  const browser = await chromium.launch({ args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext(mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      let revoked = false;
      await page.route(`**/api/design-shares/${token}`, route => route.fulfill({ status: revoked ? 404 : 200,
        contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(revoked ? { error: "not_found" } : payload) }));
      await page.goto(`${origin}/en/shared-design/${token}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      const canvas = page.locator('[data-testid="shared-model"] canvas').first();
      await canvas.waitFor({ timeout: 60000 });
      styles = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => link.outerHTML).join(""));
      await page.waitForTimeout(2000);
      const before = await canvas.screenshot();
      const pixels = await sharp(before).removeAlpha().raw().toBuffer();
      const colors = new Set<string>();
      for (let i = 0; i < pixels.length; i += 3) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
      assert(colors.size > 100, "geometry must render nonblank pixels");
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 15 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      const after = await canvas.screenshot();
      const rotated = await sharp(after).removeAlpha().raw().toBuffer();
      let changed = 0;
      for (let i = 0; i < pixels.length; i++) if (Math.abs(pixels[i] - rotated[i]) > 10) changed++;
      assert(changed > 1000, "orbit interaction must change model pixels");
      assert.equal(await page.locator('[data-testid="shared-design-viewer"] a[href*="/design/"]').count(), 0);
      assert.equal(await page.locator('[data-testid="shared-design-viewer"] input[name="length"]').count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
      await page.screenshot({ path: `/tmp/design-share-${mobile ? "mobile" : "desktop"}.png` });
      revoked = true;
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.getByRole("status").filter({ hasText: "revoked" }).waitFor();
      assert.equal(await canvas.count(), 0, "revocation must remove geometry");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("status").filter({ hasText: "revoked" }).waitFor();
      assert.equal(await canvas.count(), 0, "cached shell cannot resurrect revoked geometry");
      assert.deepEqual(errors, []);
      console.log(`${mobile ? "mobile" : "desktop"}: ${colors.size} colors, ${changed} changed channels, revocation/reload pass`);
      await context.close();
    }

    // Exercise the real share component with disposable API fixtures; never publish live data.
    const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {NextIntlClientProvider} from 'next-intl'; import {ShareDesignButton} from './components/design/ShareDesignButton'; createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale="en" messages={{}}><form data-design-form><input name="length" defaultValue="300"/></form><ShareDesignButton savedDesignId="11111111-1111-4111-8111-111111111111" savedRevision="2026-09-07T00:00:00.000Z" hasUnsavedChanges={false}/></NextIntlClientProvider>);`, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let creates = 0, deletes = 0;
    await page.route("**/__share-fixture**", route => route.fulfill({ contentType: "text/html", body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body><div id="root"></div><script src="/__share-fixture.js"></script></body></html>` }));
    await page.route("**/__share-fixture.js", route => route.fulfill({ contentType: "application/javascript", body: bundle.outputFiles[0].text }));
    await page.route("**/api/design-shares**", async route => {
      const method = route.request().method();
      if (method === "POST") { creates++; assert.deepEqual(route.request().postDataJSON(), { designId: "11111111-1111-4111-8111-111111111111", expectedUpdatedAt: "2026-09-07T00:01:00.000Z" }); }
      if (method === "DELETE") deletes++;
      await route.fulfill({ contentType: "application/json", status: method === "POST" ? 201 : 200,
        body: JSON.stringify(method === "GET" ? { shares: [], nextOffset: null } : { token, sourceRevision: "2026-09-07T00:01:00.000Z", ok: true }) });
    });
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("blocked"); } } }));
    await page.goto(`${origin}/__share-fixture?length=300`, { waitUntil: "domcontentloaded" });
    assert.equal(creates, 0);
    await page.getByRole("button", { name: "Share design", exact: true }).click();
    assert.equal(creates, 0, "opening management must never publish");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator('input[name="length"]').fill("301");
    await page.evaluate(() => history.replaceState(null, "", "?length=300&scene=studio"));
    await page.getByRole("button", { name: "Share design", exact: true }).click();
    assert(await page.getByRole("button", { name: "Publish saved version" }).isDisabled(), "visual navigation cannot clear pending input");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { id: "11111111-1111-4111-8111-111111111111", revision: "2026-09-07T00:00:00.000Z", fingerprint: "old", search: "length=300" } })));
    assert(await page.getByRole("button", { name: "Publish saved version" }).isDisabled(), "stale save cannot clear pending input");
    await page.evaluate(() => {
      history.replaceState(null, "", "?length=301&scene=studio");
      window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { id: "11111111-1111-4111-8111-111111111111", revision: "2026-09-07T00:01:00.000Z", fingerprint: "new", search: "length=301" } }));
    });
    await page.getByRole("button", { name: "Share design", exact: true }).click();
    await page.getByRole("button", { name: "Publish saved version" }).click();
    await page.getByText("Read-only link created.").waitFor();
    assert.equal(creates, 1);
    await page.getByRole("button", { name: "Copy link" }).click();
    assert.equal(await page.getByRole("textbox", { name: "Share URL" }).inputValue(), `${origin}/en/shared-design/${token}`);
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page.getByText("Link revoked.").waitFor();
    assert.equal(deletes, 1);
    assert.equal(await page.getByRole("button", { name: "Copy link" }).count(), 0);
    console.log("share dialog: explicit creation, saved-only request, clipboard fallback and revocation pass");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
