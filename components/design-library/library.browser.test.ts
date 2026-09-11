import { expect, it } from "vitest";
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

it.skipIf(process.env.RUN_LIBRARY_BROWSER !== "1")("library interactions, account isolation and responsive bilingual layouts", async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {NextIntlClientProvider} from 'next-intl';
      import en from './messages/en.json';
      import zh from './messages/zh-TW.json';
      import {MyDesignsClient} from './components/MyDesignsClient';
      const root = createRoot(document.getElementById('root'));
      window.account='a'; window.locale='en'; window.fail=false; window.delay=0;
      window.requests=[];
      window.renderLibrary=()=>root.render(<NextIntlClientProvider locale={window.locale} messages={window.locale==='en'?en:zh}><MyDesignsClient/></NextIntlClientProvider>);
      window.renderLibrary();
    `, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, outfile: "library.js", format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "library-test-boundaries", setup(b) {
      b.onResolve({ filter: /^@\/(hooks\/useUserPlan|hooks\/useUnit|lib\/supabase\/client|i18n\/navigation)$/ }, a => ({ path: a.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "tsx", resolveDir: process.cwd(), contents:
        a.path.endsWith("useUserPlan") ? `export const useUserPlan=()=>({isLoading:false,isLoggedIn:!!window.account,userId:window.account});` :
        a.path.endsWith("useUnit") ? `export const useUnit=()=> 'mm';` :
        a.path.endsWith("navigation") ? `import React from 'react'; export const Link=({prefetch,...p})=><a {...p}/>;` : `
          export const createClient=()=>({from:()=>{let owner; const q={select:()=>q,eq:(_,v)=>{owner=v;return q},order:()=>q,abortSignal:()=>q,then:resolve=>q.range(0,999).then(resolve),
            range:async(from,to)=>{const fail=window.fail, delay=window.delay; window.requests.push({owner,from,to});
              await new Promise(r=>setTimeout(r,delay));
              if(fail)return {data:null,error:{message:'offline'}};
              const data=owner==='b'?[]:[{id:'older',name:'Alpha',furniture_type:'side_table',params:{length:400,width:300,height:500},updated_at:'2026-09-01',created_at:'2026-08-01'},
                {id:'recent',name:'Beta',furniture_type:'stool',params:{},updated_at:'2026-09-07',created_at:'2026-08-02'}];
              return {data:data.slice(from,to+1),error:null};}};return q;}});
        ` }));
    } }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    let pendingMutation: Promise<void> | null = null;
    await page.route("http://library.test/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.startsWith("/thumbs/")) return route.fulfill({ body: await readFile(`${process.cwd()}/public${path}`), contentType: "image/webp" });
      if (path.startsWith("/api/designs/")) { if (pendingMutation) await pendingMutation; return route.fulfill({ json: { ok: true, name: "Renamed", updated_at: "2026-09-08" } }); }
      return route.fulfill({ body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div></body></html>', contentType: "text/html" });
    });
    await page.goto("http://library.test");
    await page.addStyleTag({ content: bundle.outputFiles.find(f => f.path.endsWith(".css"))?.text ?? "/* no scoped styles yet */" });
    await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith(".js"))!.text });
    await page.getByRole("heading", { name: "Alpha", exact: true }).waitFor();
    const recent = page.getByRole("link", { name: /Continue.*Beta/ });
    expect(await recent.getAttribute("href")).toBe("/design/stool?designId=recent&loadSaved=1");
    const search = page.getByRole("searchbox");
    await search.fill("SIDE TABLE");
    expect(await page.locator("li").count()).toBe(1);
    await search.fill("missing");
    await page.getByText("No matching designs").waitFor();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("combobox", { name: "Category" }).selectOption("side-table");
    expect(await page.locator("li").count()).toBe(1);
    await page.getByRole("combobox", { name: "Category" }).selectOption("");
    await page.getByRole("combobox", { name: "Sort" }).selectOption("name");
    expect(await page.locator("li h2").allTextContents()).toEqual(["Alpha", "Beta"]);

    for (const locale of ["en", "zh-TW"]) {
      await page.evaluate(locale => { (window as any).locale=locale; (window as any).renderLibrary(); }, locale);
      for (const width of [360, 390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const mode of ["grid", "list"]) {
          await page.getByRole("button", { name: locale === "en" ? (mode === "grid" ? "Grid view" : "List view") : (mode === "grid" ? "網格檢視" : "清單檢視"), exact: true }).click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect(await page.locator("li img").evaluateAll(imgs => imgs.every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0))).toBe(true);
          await page.screenshot({ path: `/tmp/design-library-${locale}-${width}-${mode}.png`, fullPage: true });
        }
      }
    }
    await page.evaluate(() => { (window as any).locale='en'; (window as any).renderLibrary(); });
    await page.setViewportSize({ width: 360, height: 780 });
    const rename = page.getByRole("button", { name: "Rename Alpha", exact: true });
    await rename.click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    expect(await rename.evaluate(el => el === document.activeElement)).toBe(true);
    await rename.click();
    await page.getByRole("textbox", { name: "Design name" }).fill("Renamed");
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await page.getByRole("heading", { name: "Renamed", exact: true }).waitFor();
    expect(await page.getByRole("link", { name: /Continue.*Renamed/ }).getAttribute("href")).toContain("designId=older&loadSaved=1");
    await page.getByRole("button", { name: "Delete Renamed", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("heading", { name: "Renamed", exact: true }).waitFor({ state: "detached" });

    let releaseMutation!: () => void;
    pendingMutation = new Promise<void>(resolve => { releaseMutation = resolve; });
    await page.getByRole("button", { name: "Rename Beta", exact: true }).click();
    await page.getByRole("textbox", { name: "Design name" }).fill("Old account request");
    const requestStarted = page.waitForRequest(request => request.method() === "PATCH");
    await page.getByRole("button", { name: "Save name", exact: true }).click();
    await requestStarted;
    await page.evaluate(() => { (window as any).account='c'; (window as any).renderLibrary(); });
    await page.getByRole("heading", { name: "Alpha", exact: true }).waitFor();
    await page.getByRole("button", { name: "Rename Alpha", exact: true }).click();
    expect(await page.getByRole("button", { name: "Save name", exact: true }).isEnabled()).toBe(true);
    await page.keyboard.press("Escape");
    expect(await page.getByRole("dialog").count()).toBe(0);
    releaseMutation(); pendingMutation = null;

    // A slow request must not repopulate a new account or a logged-out screen.
    await page.evaluate(() => { (window as any).account=null; (window as any).renderLibrary(); });
    await expect.poll(() => page.locator("li").count()).toBe(0);
    await page.evaluate(() => { (window as any).delay=200; (window as any).account='a'; (window as any).renderLibrary(); });
    await page.getByRole("status").waitFor();
    await page.evaluate(() => { (window as any).account='b'; (window as any).renderLibrary(); });
    await page.getByText(/haven.t saved|尚未/).waitFor();
    expect(await page.locator("li").count()).toBe(0);
    await page.evaluate(() => { (window as any).delay=0; (window as any).fail=true; (window as any).account='a'; (window as any).renderLibrary(); });
    await page.getByRole("alert").waitFor();
    await page.evaluate(() => { (window as any).fail=false; });
    await page.getByRole("button", { name: "Retry" }).click();
    await page.getByRole("heading", { name: "Alpha", exact: true }).waitFor();
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
}, 90000);
