import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, devices } from "playwright";
import sharp from "sharp";

// Run only against the coordinator's fresh build. Never starts or builds a server.
const base = process.argv[2] ?? "http://localhost:3116";
const output = path.resolve(process.argv[3] ?? ".tmp/workbench-ui");
const scenarioFilter = process.argv[4];
const groups = ["structure", "top", "base", "vises", "storage", "machining"];
const report = { base, startedAt: new Date().toISOString(), scenarios: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch();

async function centerAndCheck(locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  const result = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      clear: r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && el.contains(hit),
      target: el.outerHTML.slice(0, 250), hit: hit?.outerHTML.slice(0, 250), rect: r.toJSON(),
    };
  });
  assert.ok(result.clear, JSON.stringify(result));
}

async function runScenario(mobile, locale) {
  const id = `${mobile ? "iphone13" : "desktop"}-${locale}`;
  if (scenarioFilter && scenarioFilter !== id) return;
  const context = await browser.newContext(mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const result = { id, checks: [], errors: [], checkedControls: 0 };
  report.scenarios.push(result);
  page.on("pageerror", (error) => result.errors.push(error.message));
  const url = `${base}${locale === "en" ? "/en" : ""}/design/workbench?constructionVersion=1`;
  const visibleGroups = () => page.locator("[data-workbench-groups]:visible");
  const form = () => visibleGroups().locator("xpath=ancestor::form[1]");
  const sheet = () => page.locator('[role="dialog"]:visible').filter({ has: page.locator("[data-workbench-groups]") });
  const group = (name) => visibleGroups().locator(`[data-workbench-group="${name}"]`);
  async function openSheet() {
    if (mobile && !(await visibleGroups().count())) {
      const button = page.getByRole("button", { name: /進階設定|Advanced/ }).filter({ visible: true });
      await centerAndCheck(button);
      await button.click();
    }
    await visibleGroups().waitFor();
    assert.equal(await visibleGroups().count(), 1);
  }
  async function closeSheet() {
    if (mobile && await sheet().count()) await sheet().getByRole("button", { name: /關閉|Close/ }).click();
  }
  async function openGroup(name) {
    await openSheet();
    const details = group(name);
    if (!(await details.evaluate((el) => el.open))) {
      await centerAndCheck(details.locator("summary"));
      await details.locator("summary").click();
    }
  }
  async function choose(name, value, purpose) {
    await openGroup(purpose);
    const select = form().locator(`select[name="${name}"]`);
    if (await select.count()) {
      await centerAndCheck(select);
      await select.selectOption(value);
    } else {
      const label = form().locator(`input[type="radio"][name="${name}"][value="${value}"]`).locator("..");
      await centerAndCheck(label);
      await label.click();
    }
    await page.waitForURL((next) => next.searchParams.get(name) === value);
    await page.waitForFunction(({ name, value }) => {
      const containers = [...document.querySelectorAll("[data-workbench-groups]")].filter((el) => el.getBoundingClientRect().width);
      return containers.some((el) => {
        const select = el.querySelector(`select[name="${name}"]`);
        const radio = el.querySelector(`input[name="${name}"][value="${value}"]`);
        return select ? select.value === value : radio?.checked;
      });
    }, { name, value });
  }
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await openSheet();
    assert.deepEqual(await visibleGroups().locator("details").evaluateAll((els) => els.map((el) => el.dataset.workbenchGroup)), groups);
    assert.equal(await form().locator('[name="constructionVersion"]').count(), mobile ? 2 : 1);
    result.checks.push("six groups; constructionVersion reachable");

    const beforeToggle = page.url();
    for (const name of groups) {
      await openGroup(name);
      await centerAndCheck(group(name).locator("summary"));
      const controls = group(name).locator('label:has(input[type="radio"]), select, input[type="checkbox"], input[type="range"], input[type="number"]:not([aria-hidden="true"]):not(.sr-only), input[type="text"]:not(.sr-only), button').filter({ visible: true });
      for (const control of await controls.all()) {
        await centerAndCheck(control);
        result.checkedControls++;
      }
    }
    assert.equal(page.url(), beforeToggle, "opening groups must not dirty the URL");
    const duplicateFields = await form().evaluate((el) => {
      const data = new FormData(el);
      return [...new Set(data.keys())].filter((key) => data.getAll(key).length !== 1);
    });
    assert.deepEqual(duplicateFields, [], "successful controls must be unique");
    result.checks.push("all visible group controls unobscured; unique submitted fields; toggles do not submit");
    await page.screenshot({ path: path.join(output, `${id}-groups.png`) });

    await choose("constructionVersion", "2", "structure");
    await choose("benchStyle", "mft", "structure");
    const preset = new URL(page.url()).searchParams;
    for (const [key, value] of Object.entries({ constructionVersion: "2", frontVise: "none", dogHoles: "grid", dogHoleDia: "20", topThickness: "40" })) assert.equal(preset.get(key), value, key);
    await choose("benchStyle", "roubo", "structure");
    assert.equal(new URL(page.url()).searchParams.get("topThickness"), "75");
    result.checks.push("preset updates cross-group values; preserves version; reset to Roubo");

    await choose("materialStyle", "plywood", "structure");
    await openGroup("top");
    await form().locator('[name="plyTopLayers"]').first().waitFor({ state: "attached" });
    assert.equal(await group("top").locator('[name="topThickness"]').count(), 0);
    await choose("plyTopLayers", "4", "top");
    await choose("materialStyle", "solid", "structure");
    await choose("topSplit", "center-well", "top");
    await group("top").locator('[name="wellWidth"]').waitFor({ state: "attached" });
    await group("top").locator('[name="wellDepth"]').waitFor({ state: "attached" });
    result.checks.push("plywood layers and conditional well controls reachable");

    await closeSheet();
    const undo = page.getByRole("button", { name: /上一步|Undo/ }).filter({ visible: true });
    await centerAndCheck(undo);
    await undo.click();
    await page.waitForURL((next) => next.searchParams.get("topSplit") === "none");
    const redo = page.getByRole("button", { name: /下一步|Redo/ }).filter({ visible: true });
    await centerAndCheck(redo);
    await redo.click();
    await page.waitForURL((next) => next.searchParams.get("topSplit") === "center-well");
    const roundTrip = page.url();
    await page.reload({ waitUntil: "domcontentloaded" });
    await openSheet();
    await openGroup("top");
    await group("top").locator('[name="wellWidth"]').waitFor({ state: "attached" });
    assert.equal(page.url(), roundTrip);
    result.checks.push("undo/redo and URL reload preserve conditional state");

    await closeSheet();
    const share = page.getByRole("button", { name: /^(分享設計|Share design)$/ }).filter({ visible: true });
    assert.equal(await share.count(), 1);
    await centerAndCheck(share);
    const beforeShare = page.url();
    // This button opens a native dialog, not a route. Wait for that UI directly.
    await share.click({ noWaitAfter: true });
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor();
    assert.equal(page.url(), beforeShare, "opening sharing must not navigate");
    const publish = dialog.getByRole("button", { name: /發布已儲存版本|Publish saved version/ });
    assert.ok(await publish.isDisabled(), "unsaved anonymous design must not publish");
    await centerAndCheck(publish);
    await page.screenshot({ path: path.join(output, `${id}-share.png`) });
    await page.keyboard.press("Escape");
    result.checks.push("share entry reachable; unsaved publish disabled; no publication performed");

    const canvas = page.locator("canvas:visible").first();
    await canvas.waitFor({ timeout: 30000 });
    const pixels = await canvas.screenshot();
    const stats = await sharp(pixels).stats();
    assert.ok(stats.channels.slice(0, 3).some((channel) => channel.stdev > 4), "3D canvas appears blank");
    await writeFile(path.join(output, `${id}-canvas.png`), pixels);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "horizontal overflow");
    assert.deepEqual(result.errors, [], "browser runtime errors");
    result.checks.push("nonblank 3D canvas; no horizontal overflow or runtime errors");
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.failure = String(error?.stack ?? error);
    await page.screenshot({ path: path.join(output, `${id}-failure.png`) }).catch(() => {});
  } finally {
    result.finalUrl = page.url();
    await context.close();
    console.log(`${id}: ${result.status} (${result.checkedControls} controls)`);
    if (result.failure) console.error(result.failure);
  }
}

try {
  for (const locale of ["zh-TW", "en"]) {
    await runScenario(false, locale);
    await runScenario(true, locale);
  }
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
}
if (report.scenarios.some((scenario) => scenario.status !== "passed")) process.exitCode = 1;
