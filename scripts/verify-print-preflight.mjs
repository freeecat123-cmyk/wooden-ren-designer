import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

const origin = process.argv[2] ?? "http://localhost:3121";
const result = await build({
  stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {PrintButton} from './components/print/PrintButton';
    window.print=()=>{window.printed=true;window.dispatchEvent(new Event('afterprint'));};
    createRoot(document.getElementById('root')).render(<PrintButton preflight={{name:'長桌施工圖確認',size:'1800 × 600 × 830 mm',savedState:'changed',warnings:['示範警告：請確認支撐配置'],hasTemplates:true}}/>);
  ` }, bundle: true, write: false, platform: "browser", jsx: "automatic",
  plugins: [{ name: "locale", setup(b) {
    b.onResolve({ filter: /^next-intl$/ }, () => ({ path: "locale", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'export const useLocale=()=>"zh-TW";' }));
  } }],
});
const browser = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(`${origin}/design/cert-c1`, { waitUntil: "networkidle" });
    const styles = await p.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.map(node => node.href));
    assert(styles.length > 0);
    // Real component and app CSS; no authentication or production records involved.
    await p.setContent('<main id="root"></main>');
    for (const url of styles) await p.addStyleTag({ url });
    await p.addScriptTag({ content: result.outputFiles[0].text });
    await p.getByRole("button", { name: "列印 / 存成 PDF", exact: true }).click();
    const dialog = p.getByRole("dialog");
    assert(await dialog.isVisible());
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await dialog.boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await p.screenshot({ path: `/tmp/print-preflight-${width}.png` });
    await dialog.getByRole("button", { name: "確認列印" }).click();
    await p.waitForFunction(() => window.printed);
    console.log(`${width}: dialog fits, explicit confirmation invokes print`);
    await p.close();
  }
} finally { await browser.close(); }
