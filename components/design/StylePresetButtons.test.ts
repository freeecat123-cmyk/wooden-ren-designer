import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {StylePresetButtons} from './components/design/StylePresetButtons';
      import {FURNITURE_CATALOG} from './lib/templates';
      const root = createRoot(document.getElementById('root'));
      window.query = 'length=1800&material=pine&legSize=85&constructionVersion=1&styleVariant=77';
      window.render = (category = 'stool') => {
        const entry = FURNITURE_CATALOG.find(e => e.category === category);
        root.render(<StylePresetButtons category={category} optionSchema={entry.optionSchema}/>);
      };
      window.render();
    ` }, bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "app-boundaries", setup(b) {
      b.onResolve({ filter: /^(next\/navigation|next-intl)$/ }, args => ({ path: args.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "next-intl"
        ? `export const useLocale = () => 'en';`
        : `export const usePathname = () => '/en/design/stool';
           export const useSearchParams = () => new URLSearchParams(window.query);
           export const useRouter = () => ({replace: url => {window.query = url.split('?')[1]; window.render();}, refresh: () => {}});` }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

it.each([390, 1440])("applies and reapplies without configuration loss at %spx", async width => {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  try {
    await page.route('http://fixture.test/**', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://fixture.test/en/design/stool');
    await page.addScriptTag({ content: bundle });
    const button = page.locator('button').first();
    await button.click();
    await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]'));
    const query = await page.evaluate(() => (window as unknown as {query: string}).query);
    const params = new URLSearchParams(query);
    expect(params.get('length')).toBe('1800');
    expect(params.get('legSize')).toBe('85');
    expect(params.get('constructionVersion')).toBe('1');
    expect(params.get('material')).toBe('pine');
    expect(params.has('styleVariant')).toBe(false);
    await button.click();
    expect(await page.evaluate(() => (window as unknown as {query: string}).query)).toBe(query);
    await page.screenshot({ path: `/tmp/quick-style-${width}.png` });
    await page.evaluate(() => (window as unknown as {render: (category: string) => void}).render('workbench'));
    await page.waitForFunction(() => document.querySelectorAll('button').length === 0);
  } finally { await page.close(); }
});
