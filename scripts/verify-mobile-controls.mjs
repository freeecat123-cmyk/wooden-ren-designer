import { chromium, devices } from "playwright";
import assert from "node:assert/strict";

const origin = process.argv[2] ?? "http://localhost:3111";
const browser = await chromium.launch();
try {
  const page = await browser.newPage(devices["iPhone 13"]);
  await page.goto(`${origin}/design/workbench?length=1800`);
  const fab = page.getByRole("button", { name: "回報問題", exact: true });
  await fab.waitFor();
  await page.getByRole("button", { name: "⚙ 進階設定", exact: true }).waitFor();
  const checkPosition = async () => assert.equal(await fab.evaluate(e => getComputedStyle(e).position), "relative");
  await checkPosition();
  // Prove this probe rejects the old fixed overlay before trusting its green result.
  const mutant = await page.addStyleTag({ content: 'button[aria-label="回報問題"] { position: fixed !important; }' });
  await assert.rejects(checkPosition);
  await mutant.evaluate(e => e.remove());
  await checkPosition();
  const closeInstall = page.getByRole("button", { name: "關閉", exact: true });
  if (await closeInstall.isVisible()) await closeInstall.click();
  const numberFields = page.locator('input[type="range"]:visible');
  let checked = 0;
  for (let i = 0; i < await numberFields.count(); i++) {
    const input = numberFields.nth(i);
    const bounds = await input.boundingBox();
    if (!bounds || bounds.width < 20 || bounds.height < 20) continue;
    // Bring each control into the usable viewport above the fixed quote bar.
    await input.evaluate(e => e.scrollIntoView({ block: "center", behavior: "instant" }));
    const hit = await input.evaluate(e => {
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { clear: top === e, top: top?.outerHTML.slice(0, 350), y: r.y };
    });
    if (!hit.clear) await page.screenshot({ path: "/tmp/mobile-obstruction.png" });
    assert.equal(hit.clear, true, `visible dimension input must not be covered: ${JSON.stringify(hit)}`);
    checked++;
  }
  assert.ok(checked >= 3, "inspect all three dimension controls");
  await numberFields.first().evaluate(e => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await numberFields.first().press("ArrowRight");
  await page.waitForFunction(() => new URLSearchParams(location.search).get("length") !== "1800");
  await page.screenshot({ path: "/tmp/phase-one-mobile-controls.png" });
  await page.getByRole("button", { name: "⚙ 進階設定", exact: true }).click();
  await page.waitForFunction(() => document.body.classList.contains("wr-sheet-open"));
  assert.equal(await fab.evaluate(e => getComputedStyle(e).pointerEvents), "none");
  await page.screenshot({ path: "/tmp/phase-one-mobile-advanced.png" });
  console.log(`Mobile: ${checked} dimensions reachable, fixed-overlay mutation rejected, advanced panel clear`);
} finally { await browser.close(); }
