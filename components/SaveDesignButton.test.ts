import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, devices, type Browser } from "playwright";
import { getTemplate } from "@/lib/templates";
import { parseDesignSearchParams } from "@/lib/design/parse-search-params";
import { matchesSnapshotQuery } from "@/lib/design/model-snapshot";

let browser: Browser;
let bundle: string;
const entry = getTemplate("photo-frame")!;
const params = parseDesignSearchParams({}, entry);
const savedId = "11111111-1111-1111-1111-111111111111";
beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {SaveDesignButton} from './components/SaveDesignButton';
      import {DesignFormShell} from './components/design/DesignFormShell';
      import {DesignHistoryControls} from './components/design/DesignHistoryControls';
      const root=createRoot(document.getElementById('root'));
      window.render=()=>root.render(<>
        {window.withHistory && <DesignHistoryControls/>}
        {window.withForm && <DesignFormShell action="/design/photo-frame">
          <input name="length" type="number" defaultValue="180"/>
          <input name="constructionVersion" type="hidden" value="2"/>
          <select name="frameWidth" defaultValue="35"><option value="35">35</option><option value="40">40</option></select>
        </DesignFormShell>}
        <SaveDesignButton furnitureType="photo-frame" defaultName="Frame" {...window.props}/>
      </>);
      window.requests=[]; window.navigations=[]; window.savedEvents=[];
      window.addEventListener('wooden-ren:design-saved', e=>window.savedEvents.push(e.detail));
      window.prompt=()=> 'Test frame';
      window.fetch=(url, init)=>new Promise(resolve=>{
        window.requests.push({url,body:JSON.parse(init.body)});
        window.resolveSave=()=>resolve({ok:true,json:async()=>({id:'${savedId}',updated_at:'revision-2'})});
      });
      window.render();
    ` }, bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "save-boundaries", setup(b) {
      const stubs: Record<string, string> = {
        "next/navigation": `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({replace:(url,options)=>{window.navigations.push({url,options});history.replaceState(null,'',url);}});`,
        "next-intl": `export const useTranslations=()=>key=>key;`,
        "@/hooks/useUserPlan": `export const useUserPlan=()=>({features:{maxDesigns:10},userId:'test-owner',isLoggedIn:true,isLoading:false});`,
        "@/lib/supabase/client": `export const createClient=()=>({from:()=>({select:()=>({eq:()=>({eq:async()=>({count:0})})})})});`,
        "@/components/design/DesignVersions": `export const DesignVersions=()=>null;`,
        "@vercel/analytics": `export const track=()=>{};`,
      };
      b.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: "save-test" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "save-test" }, args => ({ contents: stubs[args.path] }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

async function mount(id?: string, mobile = false) {
  const page = await browser.newPage(mobile ? { ...devices["iPhone 13"] } : {});
  page.setDefaultTimeout(5000);
  await page.route("http://save.test/**", route => route.fulfill({ contentType: "text/html", body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' }));
  await page.goto(`http://save.test/design/photo-frame?scene=studio&wf=true&ui=v2${id ? `&designId=${id}&revision=revision-1&constructionVersion=1` : ""}`);
  await page.evaluate(({ params, id }) => { (window as any).props = { params, currentDesignId: id }; }, { params, id });
  await page.addScriptTag({ content: bundle });
  await page.getByRole("button", { name: "btnSave", exact: true }).waitFor();
  return page;
}

for (const mode of ["create", "update", "saveAs", "mobile-create"]) {
  it(`canonicalizes actual saved parameters without losing visual state: ${mode}`, async () => {
    const id = mode === "update" || mode === "saveAs" ? "old-id" : undefined;
    const page = await mount(id, mode === "mobile-create");
    try {
      await page.getByRole("button", { name: mode === "saveAs" ? "btnSaveAs" : "btnSave", exact: true }).click();
      await page.waitForFunction(() => (window as any).requests.length === 1);
      expect(await page.getByRole("status").textContent()).toBe("btnSaving");
      await page.evaluate(() => (window as any).resolveSave());
      await page.waitForFunction(() => (window as any).navigations.length === 1);
      const url = new URL(page.url());
      expect(url.searchParams.get("constructionVersion")).toBe("2");
      expect(url.searchParams.get("scene")).toBe("studio");
      expect(url.searchParams.get("wf")).toBe("true");
      expect(url.searchParams.get("ui")).toBe("v2");
      expect(url.searchParams.get("revision")).toBe("revision-2");
      expect(url.searchParams.get("designId")).toBe(mode === "update" ? "old-id" : savedId);
      const savedEvent = await page.evaluate(() => (window as any).savedEvents[0]);
      expect(new URLSearchParams(savedEvent.search).get("constructionVersion")).toBe("2");
      expect(new URLSearchParams(savedEvent.search).get("revision")).toBe("revision-2");
      const query = Object.fromEntries(url.searchParams);
      const defaults = Object.fromEntries(entry.optionSchema!.map(s => [s.key, s.defaultValue]));
      expect(matchesSnapshotQuery(query, { ...params }, entry.optionSchema!.map(s => s.key), defaults)).toBe(true);
      const reopened = parseDesignSearchParams(query, entry);
      expect(reopened).toEqual(params);
      await page.evaluate(({ reopened, id }) => { (window as any).props = { params: reopened, currentDesignId: id }; (window as any).render(); }, { reopened, id: url.searchParams.get("designId") });
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === "saved");
      expect(await page.evaluate(() => (window as any).requests[0].body.params)).toEqual(params);
      expect(await page.evaluate(() => (window as any).navigations[0].options)).toEqual({ scroll: false });
    } finally { await page.close(); }
  });
}

it("does not overwrite edits made while a save is in flight", async () => {
  const page = await mount("old-id");
  try {
    await page.getByRole("button", { name: "btnSave", exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    await page.evaluate(() => {
      const w = window as any;
      w.props = { ...w.props, params: { ...w.props.params, length: 444 } };
      history.replaceState(null, '', '?length=444&constructionVersion=2&scene=dark&designId=old-id&revision=revision-1');
      w.render();
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).resolveSave());
    await page.waitForFunction(() => (window as any).navigations.length === 1);
    expect(new URL(page.url()).searchParams.get("length")).toBe("444");
    expect(new URL(page.url()).searchParams.get("scene")).toBe("dark");
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === "unsaved");
    expect(await page.evaluate(() => (window as any).requests.length)).toBe(1);
  } finally { await page.close(); }
});

it("unchanged input blur does not navigate before saving", async () => {
  const page = await mount("old-id");
  try {
    await page.evaluate(() => { (window as any).withForm = true; (window as any).render(); });
    await page.locator('input[name="length"]').focus();
    await page.getByRole("button", { name: "btnSave", exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    expect(await page.evaluate(() => (window as any).navigations)).toEqual([]);
    await page.evaluate(() => (window as any).resolveSave());
  } finally { await page.close(); }
});

it("pending form navigation cannot restore the pre-save revision", async () => {
  const page = await mount("old-id");
  try {
    await page.evaluate(() => { (window as any).withForm = true; (window as any).render(); });
    await page.locator('select[name="frameWidth"]').selectOption("40");
    await page.getByRole("button", { name: "btnSave", exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    await page.evaluate(() => (window as any).resolveSave());
    await page.waitForFunction(() => (window as any).savedEvents.length === 1);
    await page.waitForTimeout(700);
    const url = new URL(page.url());
    expect(url.searchParams.get("revision")).toBe("revision-2");
    expect(url.searchParams.get("designId")).toBe("old-id");
    expect(url.searchParams.get("frameWidth")).toBe("40");
  } finally { await page.close(); }
});

it("retains a newer URL edit before its server props arrive", async () => {
  const page = await mount("old-id");
  try {
    await page.getByRole("button", { name: "btnSave", exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    await page.evaluate(() => {
      history.replaceState(null, '', '?length=445&constructionVersion=2&designId=old-id&revision=revision-1');
      (window as any).resolveSave();
    });
    await page.waitForFunction(() => (window as any).navigations.length === 1);
    expect(new URL(page.url()).searchParams.get("length")).toBe("445");
    expect(new URL(page.url()).searchParams.get("revision")).toBe("revision-2");
  } finally { await page.close(); }
});

for (const resetQuery of ['?designId=old-id&revision=revision-1&constructionVersion=2', '']) {
it(`does not restore URL keys deleted by Reset before new props arrive: ${resetQuery || 'empty URL'}`, async () => {
  const page = await mount("old-id");
  try {
    await page.evaluate(() => {
      const w = window as any;
      history.replaceState(null, '', '?designId=old-id&revision=revision-1&constructionVersion=2&topSplit=gap&gapWidth=70');
      w.props.params = { ...w.props.params, options: { ...w.props.params.options, topSplit: 'gap', gapWidth: 70 } };
      w.render();
    });
    await page.waitForTimeout(50);
    await page.getByRole('button', { name: 'btnSave', exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    await page.evaluate(query => {
      history.replaceState(null, '', location.pathname + query);
      (window as any).resolveSave();
    }, resetQuery);
    await page.waitForFunction(() => (window as any).savedEvents.length === 1);
    const query = new URL(page.url()).searchParams;
    expect(query.has('topSplit')).toBe(false);
    expect(query.has('gapWidth')).toBe(false);
    expect(query.get('revision')).toBe('revision-2');
    expect(parseDesignSearchParams(Object.fromEntries(query), entry).options.constructionVersion).toBe('2');
    const event = await page.evaluate(() => (window as any).savedEvents[0]);
    expect(new URLSearchParams(event.search).get('gapWidth')).toBe('70');
    await page.evaluate(params => {
      const w = window as any; w.props.params = params; w.render();
    }, params);
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === 'unsaved');
  } finally { await page.close(); }
});
}

for (const mode of ['create', 'update', 'saveAs']) {
  it(`does not add a no-op undo when Save canonicalizes a sparse URL: ${mode}`, async () => {
    const id = mode === 'create' ? undefined : 'old-id';
    const page = await mount(id);
    try {
      await page.evaluate(id => {
        const w = window as any;
        history.replaceState(null, '', '?length=1800' + (id ? '&designId=' + id + '&revision=revision-1' : ''));
        w.props.params = { ...w.props.params, length: 1800, width: 600, height: 830 };
        w.withHistory = true; w.render();
      }, id);
      await page.getByRole('button', { name: 'undo', exact: true }).waitFor();
      await page.evaluate(() => {
        const w = window as any, q = new URLSearchParams(location.search);
        q.set('length', '1900'); history.replaceState(null, '', '?' + q);
        w.props.params = { ...w.props.params, length: 1900 }; w.render();
      });
      await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('button[title="undoTitle"]')?.disabled === false);
      await page.getByRole('button', { name: mode === 'saveAs' ? 'btnSaveAs' : 'btnSave', exact: true }).click();
      await page.waitForFunction(() => (window as any).requests.length === 1);
      await page.evaluate(() => (window as any).resolveSave());
      await page.waitForFunction(() => (window as any).savedEvents.length === 1);
      expect(new URL(page.url()).searchParams.get('width')).toBe('600');
      expect(new URL(page.url()).searchParams.get('height')).toBe('830');
      await page.evaluate(() => {
        const w = window as any;
        w.props.currentDesignId = new URLSearchParams(location.search).get('designId'); w.render();
      });
      await page.waitForTimeout(50);
      await page.getByRole('button', { name: 'undo', exact: true }).click();
      expect(new URL(page.url()).searchParams.get('length')).toBe('1800');
      expect(new URL(page.url()).searchParams.get('revision')).toBe('revision-2');
      await page.getByRole('button', { name: 'redo', exact: true }).click();
      expect(new URL(page.url()).searchParams.get('length')).toBe('1900');
    } finally { await page.close(); }
  });
}

it("cancels the form debounce on unmount", async () => {
  const page = await mount("old-id");
  try {
    await page.evaluate(() => {
      const w = window as any, schedule = window.setTimeout.bind(window), cancel = window.clearTimeout.bind(window);
      w.pendingFormTimers = new Set();
      w.setTimeout = (fn: () => void, ms: number) => {
        const id = schedule(() => { w.pendingFormTimers.delete(id); fn(); }, ms);
        if (ms === 200 || ms === 600) w.pendingFormTimers.add(id);
        return id;
      };
      w.clearTimeout = (id: number) => { w.pendingFormTimers.delete(id); cancel(id); };
      w.withForm = true; w.render();
    });
    await page.locator('select[name="frameWidth"]').selectOption("40");
    expect(await page.evaluate(() => (window as any).pendingFormTimers.size)).toBe(1);
    await page.evaluate(() => { (window as any).withForm = false; (window as any).render(); });
    await page.waitForFunction(() => (window as any).pendingFormTimers.size === 0);
    expect(await page.evaluate(() => (window as any).navigations)).toEqual([]);
  } finally { await page.close(); }
});

it("uses a later restored revision instead of retaining the previous save event", async () => {
  const page = await mount("old-id");
  try {
    await page.evaluate(() => { (window as any).withForm = true; (window as any).render(); });
    await page.getByRole("button", { name: "btnSave", exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    await page.evaluate(() => (window as any).resolveSave());
    await page.waitForFunction(() => (window as any).savedEvents.length === 1);
    await page.evaluate(() => {
      const query = new URLSearchParams(location.search); query.set('revision', 'revision-3');
      history.replaceState(null, '', '?' + query);
      (window as any).render();
    });
    await page.locator('select[name="frameWidth"]').selectOption('40');
    await page.waitForTimeout(350);
    expect(new URL(page.url()).searchParams.get('revision')).toBe('revision-3');
  } finally { await page.close(); }
});

it("ignores a save response after switching to another design", async () => {
  const page = await mount("old-id");
  try {
    await page.getByRole("button", { name: "btnSave", exact: true }).click();
    await page.waitForFunction(() => (window as any).requests.length === 1);
    await page.evaluate(() => { (window as any).props.currentDesignId = 'different-id'; (window as any).render(); });
    await page.waitForTimeout(50);
    await page.evaluate(() => (window as any).resolveSave());
    await page.getByRole("button", { name: "btnSave", exact: true }).waitFor();
    expect(await page.evaluate(() => (window as any).navigations)).toEqual([]);
    expect(await page.evaluate(() => (window as any).savedEvents)).toEqual([]);
  } finally { await page.close(); }
});
