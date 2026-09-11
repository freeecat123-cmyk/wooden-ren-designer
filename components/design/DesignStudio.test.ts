import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser, type Page } from "playwright";
import type { FurnitureDesign } from "@/lib/types";

const design: FurnitureDesign = {
  id: "studio-test", category: "stool", nameZh: "方凳",
  overall: { length: 400, width: 300, thickness: 450 },
  defaultJoinery: "blind-tenon", primaryMaterial: "maple",
  parts: [{
    id: "rail", nameZh: "橫撐", nameEn: "Rail", material: "maple",
    materialOverride: "plywood", grainDirection: "length",
    visible: { length: 300, width: 40, thickness: 20 },
    joineryView: { visible: { length: 310, width: 40, thickness: 20 } },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [{ position: "start", type: "blind-tenon", length: 15, width: 20, thickness: 8 }],
    mortises: [],
  }],
};
let browser: Browser;
let script: string;
let css: string;

beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {DesignStudio} from './components/design/DesignStudio';
      import {SelectedPartProvider, useSelectedPart} from './components/SelectedPartContext';
      import {HoveredPartsProvider} from './components/HoveredPartsContext';
      function Fixture() {
        const [design, setDesign] = useState(${JSON.stringify(design)});
        const {selectedPartId, setSelectedPartId} = useSelectedPart();
        return <DesignStudio locale={new URLSearchParams(location.search).get('locale') || 'en'}
          design={design} title="Workshop stool with a deliberately long saved design name"
          toolbar={<><button onClick={() => setDesign({...design, parts: []})}>Remove part</button>
            <output data-selection>{selectedPartId || 'none'}</output></>}
          parameters={<form className="studio-parameter-form" onSubmit={e => {e.preventDefault(); window.submits = (window.submits || 0) + 1;}}>
            <label>Width<input name="width" defaultValue="400" /></label>
            <input className="sr-only" name="raw-mm" type="number" defaultValue="400" tabIndex={-1} aria-hidden />
            <button type="submit">Apply</button></form>}
          model={<div data-studio-model><div style={{height: 450}}><canvas aria-label="Furniture model" />
            <button onClick={() => setSelectedPartId('rail')}>Select rail</button></div></div>}
          drawings={<><input aria-label="Drawing scale" defaultValue="1:10" /><button data-part-drawing-ids={JSON.stringify(['mirror-rail', 'rail'])}>Rail drawing</button></>}
          materials={<button data-part-id="rail" onClick={() => setSelectedPartId('rail')}>Material rail</button>}
          build={<input aria-label="Build notes" defaultValue="" />}
          quote={<input aria-label="Quote amount" defaultValue="120" />}
          notices={<p role="status">Unsaved changes</p>} />;
      }
      createRoot(document.getElementById('root')).render(
        <SelectedPartProvider><HoveredPartsProvider><Fixture /></HoveredPartsProvider></SelectedPartProvider>
      );
    ` },
    bundle: true, write: false, outdir: "studio-browser-test", platform: "browser", jsx: "automatic",
  });
  script = result.outputFiles.find(file => file.path.endsWith(".js"))!.text;
  css = result.outputFiles.find(file => file.path.endsWith(".css"))!.text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

async function open(width = 1440, locale = "en") {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultTimeout(5000);
  await page.route("http://studio.test/**", route => route.fulfill({
    contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div></body></html>',
  }));
  await page.goto(`http://studio.test/?locale=${locale}`);
  await page.addStyleTag({ content: `.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}${css}` });
  await page.addScriptTag({ content: script });
  await page.getByRole("tab").first().waitFor();
  return page;
}

async function activeIs(page: Page, selector: string) {
  return page.evaluate(selector => document.activeElement?.matches(selector), selector);
}

it("shows mobile selection facts and locates the material and grouped drawing without losing selection", async () => {
  const page = await open(390);
  try {
    await page.getByRole('button', { name: 'Select rail', exact: true }).click();
    const summary = page.getByRole('region', { name: 'Selected part', exact: true });
    await summary.waitFor();
    expect(await summary.textContent()).toContain('Rail');
    expect(await summary.textContent()).toContain('Plywood');
    expect(await summary.textContent()).toContain('325 × 40 × 20 mm');
    const summaryBox = (await summary.boundingBox())!;
    const modelBox = (await page.locator('[data-studio-model]').boundingBox())!;
    expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(modelBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '/tmp/woodenren-selection-mobile.png' });
    await summary.getByRole('button', { name: 'Locate material', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-part-id') === 'rail');
    await summary.getByRole('button', { name: 'Locate drawing', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-part-drawing-ids'));
    expect(await page.locator('[data-selection]').textContent()).toBe('rail');
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await summary.getByRole('button', { name: 'Clear selection', exact: true }).click();
    expect(await summary.count()).toBe(0);
  } finally { await page.close(); }
});

it("disables a missing drawing destination and preserves material selection", async () => {
  const page = await open();
  try {
    await page.locator('[data-part-drawing-ids]').evaluate(node => node.removeAttribute('data-part-drawing-ids'));
    await page.getByRole('tab', { name: 'Materials', exact: true }).click();
    await page.getByRole('button', { name: 'Material rail', exact: true }).click();
    const summary = page.getByRole('region', { name: 'Selected part', exact: true });
    await expect.poll(() => summary.getByRole('button', { name: 'Locate material' }).isEnabled()).toBe(true);
    expect(await summary.getByRole('button', { name: 'Locate drawing' }).isDisabled()).toBe(true);
    await page.screenshot({ path: '/tmp/woodenren-selection-desktop.png' });
  } finally { await page.close(); }
});

it("keeps screen-reader-only numeric fields one pixel wide", async () => {
  const page = await open();
  try {
    expect(await page.locator('input[name="raw-mm"]').evaluate(node => getComputedStyle(node).width)).toBe("1px");
  } finally { await page.close(); }
});

it("keeps all view inputs and one model mounted, with inactive content hidden and inert", async () => {
  const page = await open();
  try {
    expect(await page.getByRole("tab").allTextContents()).toEqual(["Design", "Drawings", "Materials", "Build", "Quote"]);
    await page.getByRole("textbox", { name: "Width", exact: true }).fill("457");
    const canvas = await page.locator("canvas").elementHandle();
    for (const tab of ["Drawings", "Materials", "Build", "Quote"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      expect(await page.getByRole("tabpanel").count()).toBe(1);
      expect(await page.locator('[role="tabpanel"][hidden][inert]').count()).toBe(tab === "Materials" ? 3 : 4);
      expect(await page.getByRole("textbox", { name: "Width", exact: true }).isVisible()).toBe(false);
      expect(await page.locator('input[name="width"]').isDisabled()).toBe(false);
      expect(await page.locator("canvas").count()).toBe(1);
    }
    await page.getByRole("textbox", { name: "Quote amount" }).fill("995");
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    expect(await page.getByRole("textbox", { name: "Width", exact: true }).inputValue()).toBe("457");
    await page.getByRole("tab", { name: "Quote", exact: true }).click();
    expect(await page.getByRole("textbox", { name: "Quote amount" }).inputValue()).toBe("995");
    expect(await page.evaluate(() => (window as unknown as { submits?: number }).submits ?? 0)).toBe(0);
    expect(await canvas!.evaluate(node => node === document.querySelector("canvas"))).toBe(true);
  } finally { await page.close(); }
});

it.each([390, 1440])("keeps the same interactive model beside materials at %spx", async width => {
  const page = await open(width);
  try {
    const canvas = await page.locator("canvas").elementHandle();
    await page.getByRole("tab", { name: "Materials", exact: true }).click();
    expect(await page.locator("canvas").isVisible()).toBe(true);
    expect(await page.getByRole("button", { name: "Material rail", exact: true }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "Material rail", exact: true }).click();
    expect(await page.locator('[data-selection]').textContent()).toBe("rail");
    expect(await page.locator("canvas").evaluate(node => Boolean(node.closest('[inert]')))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/studio-materials-${width}.png`, fullPage: true });
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    expect(await canvas!.evaluate(node => node === document.querySelector("canvas"))).toBe(true);
  } finally { await page.close(); }
});

it("supports roving keyboard tabs and independent desktop panel collapse", async () => {
  const page = await open();
  try {
    await page.getByRole("tab", { name: "Design", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    expect(await page.getByRole("tab", { name: "Drawings", exact: true }).getAttribute("aria-selected")).toBe("true");
    await page.keyboard.press("End");
    expect(await page.getByRole("tab", { name: "Quote", exact: true }).getAttribute("aria-selected")).toBe("true");
    await page.keyboard.press("Home");
    await page.getByRole("button", { name: "Toggle parameters", exact: true }).click();
    expect(await page.getByRole("textbox", { name: "Width", exact: true }).isVisible()).toBe(false);
    expect(await page.getByRole("heading", { name: "Overview", exact: true }).isVisible()).toBe(true);
    await page.getByRole("button", { name: "Toggle inspector", exact: true }).click();
    expect(await page.getByRole("heading", { name: "Overview", exact: true }).isVisible()).toBe(false);
    await page.getByRole("button", { name: "Toggle parameters", exact: true }).click();
    expect(await page.getByRole("textbox", { name: "Width", exact: true }).isVisible()).toBe(true);
  } finally { await page.close(); }
});

it("uses parent selection, physical cut dimensions and material override, and clears stale ids", async () => {
  const page = await open();
  try {
    await page.getByRole("button", { name: "Select rail", exact: true }).click();
    const inspector = page.locator('[data-studio-panel="inspector"]');
    expect(await inspector.textContent()).toContain("Rail");
    expect(await inspector.textContent()).toContain("Plywood");
    expect(await inspector.textContent()).toContain("300 × 40 × 20 mm");
    expect(await inspector.textContent()).toContain("325 × 40 × 20 mm");
    expect(await inspector.textContent()).toContain("Blind tenon");
    await inspector.getByRole("button", { name: "Clear selection", exact: true }).click();
    expect(await page.locator('[data-selection]').textContent()).toBe("none");
    await page.getByRole("button", { name: "Select rail", exact: true }).click();
    await page.getByRole("button", { name: "Remove part", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-selection]')?.textContent === 'none');
    expect(await inspector.textContent()).toContain("Overview");
  } finally { await page.close(); }
});

it("contains mobile sheet focus, closes on Escape and restores focus without losing input", async () => {
  const page = await open(390);
  try {
    const trigger = page.getByRole("button", { name: "Toggle parameters", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Parameters", exact: true });
    await dialog.waitFor();
    expect(await dialog.evaluate(node => node.matches(':modal'))).toBe(true);
    await page.getByRole("textbox", { name: "Width", exact: true }).fill("512");
    await dialog.getByRole("button", { name: "Apply", exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(await activeIs(page, '[aria-label="Close parameters"]')).toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect(await activeIs(page, 'button[type="submit"]')).toBe(true);
    await page.keyboard.press("Escape");
    expect(await dialog.isVisible()).toBe(false);
    expect(await activeIs(page, '[aria-label="Toggle parameters"]')).toBe(true);
    await trigger.click();
    expect(await page.getByRole("textbox", { name: "Width", exact: true }).inputValue()).toBe("512");
    await page.getByRole("button", { name: "Close parameters", exact: true }).click();
    await page.getByRole("button", { name: "Toggle inspector", exact: true }).click();
    await page.getByRole("dialog", { name: "Inspector", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    expect(await activeIs(page, '[aria-label="Toggle inspector"]')).toBe(true);
  } finally { await page.close(); }
});

it("uses a tablet inspector drawer and preserves the same form and canvas through resizing", async () => {
  const page = await open();
  try {
    await page.getByRole("textbox", { name: "Width", exact: true }).fill("601");
    const input = await page.locator('input[name="width"]').elementHandle();
    const canvas = await page.locator("canvas").elementHandle();
    await page.setViewportSize({ width: 768, height: 900 });
    await page.getByRole("button", { name: "Toggle inspector", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Inspector", exact: true });
    await dialog.waitFor();
    expect(await dialog.evaluate(node => node.matches(':modal'))).toBe(true);
    await page.keyboard.press("Escape");
    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.locator('input[name="width"]').count()).toBe(1);
      expect(await input!.evaluate(node => node === document.querySelector('input[name="width"]'))).toBe(true);
      expect(await canvas!.evaluate(node => node === document.querySelector("canvas"))).toBe(true);
      expect(await page.locator('input[name="width"]').inputValue()).toBe("601");
    }
  } finally { await page.close(); }
});

for (const locale of ["en", "zh"]) {
  it(`has no page overflow and captures shell states at all approved widths (${locale})`, async () => {
    const page = await open(1440, locale);
    try {
      for (const width of [360, 390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const tabs = page.getByRole("tab");
        for (const tab of await tabs.all()) {
          const box = await tab.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
        await page.screenshot({ path: `/tmp/design-studio-${locale}-${width}.png`, fullPage: true });
      }
    } finally { await page.close(); }
  });
}
