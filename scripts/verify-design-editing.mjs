import { build } from "esbuild";
import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const messages = JSON.parse(readFileSync("messages/zh-TW.json", "utf8"));
const css = existsSync(".next/static/chunks")
  ? readdirSync(".next/static/chunks").filter(f => f.endsWith(".css")).map(f => readFileSync(`.next/static/chunks/${f}`, "utf8")).join("\n")
  : readFileSync(".next/dev/static/css/app/[locale]/layout.css", "utf8");
const navigation = `import {useSyncExternalStore} from 'react';
const subscribe=cb=>{addEventListener('fixture-navigation',cb);return()=>removeEventListener('fixture-navigation',cb)};
export const usePathname=()=>location.pathname;
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
export const useRouter=()=>({replace(url){history.replaceState(null,'',url);dispatchEvent(new Event('fixture-navigation'))}});`;
const bundle = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
    import {useSearchParams,useRouter} from 'next/navigation';
    import {SaveDesignButton} from './components/SaveDesignButton';
    import {DesignDraftRecovery} from './components/design/DesignDraftRecovery';
    import {DesignHistoryControls} from './components/design/DesignHistoryControls';
    function App(){const q=useSearchParams(),r=useRouter();const length=Number(q.get('length')||500);
      return <><label>Length<input aria-label="Length" type="number" value={length} onChange={e=>{q.set('length',e.target.value);r.replace(location.pathname+'?'+q)}}/></label>
      <SaveDesignButton furnitureType="tea-table" defaultName="Tea" currentDesignId={q.get('designId')} params={{length,options:{hasLowerShelf:true}}}/>
      <DesignHistoryControls/><DesignDraftRecovery/></>}
    createRoot(document.getElementById('root')).render(<App/>);`, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, format: "iife", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "fixtures", setup(b) {
    b.onResolve({ filter: /^next-intl$|^next\/navigation$|^@\/hooks\/useUserPlan$|^@\/lib\/supabase\/client$|^@vercel\/analytics$/ }, args => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ resolveDir: process.cwd(), contents:
      args.path === "next/navigation" ? navigation :
      args.path === "next-intl" ? `const m=${JSON.stringify(messages)};export const useLocale=()=>"zh-TW";export const useTranslations=ns=>(key,vars={})=>{let v=(ns+'.'+key).split('.').reduce((v,k)=>v?.[k],m)||key;return v.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??k)};` :
      args.path.includes("useUserPlan") ? 'export const useUserPlan=()=>({features:{maxDesigns:100},userId:"fixture-user",isLoggedIn:true,isLoading:false});' :
      args.path.includes("supabase") ? 'export const createClient=()=>({from:()=>({select:()=>({eq:()=>({eq:async()=>({count:0})})})})});' : 'export const track=()=>{};'
    }));
  } }],
});
const browser = await chromium.launch();
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(mobile ? devices["iPhone 13"] : { viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    let saves = 0;
    let deferSave = false;
    let releaseSave;
    let lastParams;
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/api/designs/")) {
        saves++;
        lastParams = route.request().postDataJSON().params;
        if (deferSave) await new Promise(resolve => { releaseSave = resolve; });
        return route.fulfill({ json: { id: url.pathname.endsWith("/create") ? "copy" : "fixture", updated_at: `revision-${saves}` } });
      }
      return route.fulfill({ contentType: "text/html", body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles[0].text}</script></html>` });
    });
    await page.goto("http://editing.test/design/tea-table?designId=fixture&revision=revision-0&length=500");
    const length = page.getByRole("spinbutton", { name: "Length" });
    await length.fill("600");
    await page.waitForFunction(() => Object.keys(localStorage).some(k => k.startsWith("wooden-ren:draft:") && localStorage.getItem(k).includes("length=600")));
    await page.getByRole("button", { name: "上一步", exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("length") === "500");
    // Returning to the original state must not offer an abandoned edit after reload.
    await page.reload();
    await length.waitFor();
    assert.equal(await page.getByRole("button", { name: "恢復草稿", exact: true }).count(), 0, "undo must clear obsolete draft");
    await length.fill("650");
    await page.getByRole("button", { name: messages.saveDesign.btnSave, exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("revision") === "revision-1");
    assert.equal(saves, 1);
    await page.getByRole("button", { name: messages.saveDesign.btnSave, exact: true }).click();
    await page.waitForTimeout(150);
    assert.equal(saves, 1, "unchanged saves must not create redundant versions");
    deferSave = true;
    await length.fill("675");
    const request = page.waitForRequest(r => r.method() === "PATCH");
    await page.getByRole("button", { name: messages.saveDesign.btnSave, exact: true }).click();
    await request;
    await length.fill("700");
    assert.equal(lastParams.length, 675);
    deferSave = false;
    releaseSave();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("revision") === "revision-2");
    await page.getByRole("status").filter({ hasText: messages.saveDesign.unsaved }).waitFor();
    assert.equal(await length.inputValue(), "700", "late save response must not erase newer edits");
    await page.getByRole("button", { name: messages.saveDesign.btnSave, exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("revision") === "revision-3");
    assert.equal(lastParams.length, 700);
    page.once("dialog", dialog => dialog.accept("Copy"));
    await page.getByRole("button", { name: messages.saveDesign.btnSaveAs, exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("designId") === "copy");
    assert.equal(saves, 4);
    await page.getByRole("button", { name: "上一步", exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("length") !== "700");
    assert.equal(new URL(page.url()).searchParams.get("designId"), "copy", "undo after Save As must stay in the new design");
    assert.equal(new URL(page.url()).searchParams.get("revision"), "revision-4");
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("length") === "700");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `/tmp/design-editing-${mobile ? "mobile" : "desktop"}.png` });
    console.log(`${mobile ? "Mobile" : "Desktop"}: undo/draft cleanup, repeat-save, in-flight edits, Save As and history migration passed`);
    await context.close();
  }
} finally { await browser.close(); }
