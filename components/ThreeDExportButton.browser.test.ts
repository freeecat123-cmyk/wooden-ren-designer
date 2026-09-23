import { expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, devices } from "playwright";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { unzipSync } from "fflate";

// Explicit opt-in: this focused integration test needs an installed Playwright browser.
it.skipIf(process.env.RUN_EXPORT_BROWSER !== "1")("real desktop/mobile export controls and 3MF volume", async () => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {NextIntlClientProvider} from 'next-intl';
    import {ThreeDExportButton} from './components/ThreeDExportButton';
    import messages from './messages/en.json';
    const part = {id:'stock',nameZh:'stock',material:'white-oak',grainDirection:'length',
      visible:{length:100,thickness:20,width:60},origin:{x:130,y:40,z:70},tenons:[],
      mortises:[{origin:{x:10,y:20,z:0},depth:10,length:20,width:10,through:false,cosmetic:true}]};
    const root=createRoot(document.getElementById('root'));
    window.renderExport=(broken=false,joined=false)=>{const model={category:'stool',parts:[{...part,
        visible:broken ? {...part.visible,length:0} : part.visible,
        tenons:joined ? [{position:'end',type:'blind-tenon',length:10,width:10,thickness:10}] : []}]};
      root.render(<NextIntlClientProvider locale="en" messages={messages}>
      <ThreeDExportButton design={model} machiningDesign={model}/>
    </NextIntlClientProvider>)};
    window.renderExport();
    window.downloads=[];
    HTMLAnchorElement.prototype.click = async function() {
      const buffer=await (await fetch(this.href)).arrayBuffer();
      window.downloads.push({name:this.download, bytes:Array.from(new Uint8Array(buffer))});
    };
  `, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, format: "iife",
    platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
  const css = await postcss([tailwind()]).process('@import "tailwindcss"; @source "../components/ThreeDExportButton.tsx";', { from: `${process.cwd()}/app/export-browser.css` });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mobile of [false, true]) for (const joined of [false, true]) {
      const context = await browser.newContext(mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
      await page.addStyleTag({ content: css.css });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(joined => (window as any).renderExport(false, joined), joined);
      const mode = page.getByRole("combobox", { name: "Export geometry" });
      await mode.selectOption(joined ? "joinery-accurate" : "mortise-accurate");
      await page.getByText(joined ? /Supported joinery only/ : /tenon protrusions/).waitFor();
      expect(await page.getByRole("alert").allTextContents()).toEqual([]);
      const labels = await page.locator("button").allTextContents();
      // First four controls are the existing STL / OBJ / flat STL / 3MF commands.
      for (let i = 0; i < 4; i++) {
        const button = page.locator("button").nth(i);
        await button.scrollIntoViewIfNeeded();
        expect(await button.evaluate(el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), labels[i]).toBe(true);
        await button.click();
        await page.waitForFunction(n => (window as any).downloads.length === n, i + 1);
      }
      const downloads = await page.evaluate(() => (window as any).downloads as Array<{name: string; bytes: number[]}>);
      expect(downloads.every(d => d.name.includes(joined ? "supported-joinery" : "mortise-only"))).toBe(true);
      const xml = new TextDecoder().decode(unzipSync(new Uint8Array(downloads[3].bytes))["3D/3dmodel.model"]);
      const measured = await page.evaluate(xml => {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        const vertices = Array.from(doc.querySelectorAll("vertex"), e => ["x", "y", "z"].map(k => Number(e.getAttribute(k))));
        let v = 0;
        for (const tri of doc.querySelectorAll("triangle")) {
          const [a,b,c] = ["v1","v2","v3"].map(k => vertices[Number(tri.getAttribute(k))]);
          v += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
        }
        return { volume: Math.abs(v), unit: doc.documentElement.getAttribute("unit") };
      }, xml);
      expect(measured.volume).toBeCloseTo(joined ? 119 : 118, 2);
      expect(measured.unit).toBe("millimeter");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `/tmp/${joined ? "joinery" : "mortise"}-export-${mobile ? "mobile" : "desktop"}.png`, fullPage: true });
      await page.evaluate(() => (window as any).renderExport(true));
      await page.getByRole("alert").waitFor();
      for (let i = 0; i < 4; i++) expect(await page.locator("button").nth(i).isDisabled()).toBe(true);
      await context.close();
    }
  } finally { await browser.close(); }
}, 60000);
