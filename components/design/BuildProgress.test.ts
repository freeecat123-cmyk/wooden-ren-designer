import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {BuildProgress} from './components/design/BuildProgress';
      const root=createRoot(document.getElementById('root'));
      window.version='v1'; window.owner='owner';
      window.render=()=>root.render(<BuildProgress category="table" fingerprint={window.version} steps={[{id:'cut',title:'裁切'},{id:'fit',title:'試組'}]}>{[<div key="cut">安全提醒</div>,<div key="fit">試組內容</div>]}</BuildProgress>); window.render();
    ` }, bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "boundaries", setup(b) {
      const stubs: Record<string, string> = {
        "next/navigation": `export const useSearchParams=()=>new URLSearchParams(location.search);`,
        "@/hooks/useUserPlan": `export const useUserPlan=()=>({userId:window.owner,isLoading:false});`,
      };
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: "stub" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "stub" }, a => ({ contents: stubs[a.path] }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
});
afterAll(async () => browser?.close());

async function open() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('http://progress.test/**', r => r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
  await page.goto('http://progress.test/?designId=a');
  await page.addScriptTag({content:bundle});
  return page;
}

it('persists completion, focuses the next step and isolates saved designs and accounts', async () => {
  const p = await open();
  try {
    await p.getByRole('checkbox',{name:'裁切'}).check();
    await p.getByText('已完成 1 / 2').waitFor();
    await p.getByRole('button',{name:'下一個未完成'}).click();
    expect(await p.locator(':focus').getAttribute('data-build-step')).toBe('fit');
    await p.reload(); await p.addScriptTag({content:bundle});
    await p.waitForFunction(()=>document.querySelector<HTMLInputElement>('input')?.checked);
    await p.evaluate(()=>{ history.replaceState(null,'','?designId=b'); (window as any).render(); });
    await p.getByText('已完成 0 / 2').waitFor();
    await p.evaluate(()=>{ history.replaceState(null,'','?designId=a'); (window as any).owner='other'; (window as any).render(); });
    await p.getByText('已完成 0 / 2').waitFor();
  } finally { await p.close(); }
});

it('requires confirmation after a design change and keeps safety content visible', async () => {
  const p=await open();
  try {
    await p.getByRole('checkbox',{name:'裁切'}).check();
    await p.evaluate(()=>{(window as any).version='v2'; (window as any).render();});
    await p.getByText('設計已變更，請確認製作進度。').waitFor();
    expect(await p.getByRole('checkbox',{name:'裁切'}).isDisabled()).toBe(true);
    expect(await p.getByText('安全提醒').isVisible()).toBe(true);
    await p.getByRole('button',{name:'保留已完成項目'}).click();
    await p.getByText('已完成 1 / 2').waitFor();
    await p.evaluate(()=>{(window as any).version='v3'; (window as any).render();});
    await p.getByRole('button',{name:'重新開始'}).click();
    await p.getByText('已完成 0 / 2').waitFor();
  } finally {await p.close();}
});

it('reports storage failures without claiming persistence', async () => {
  const p=await open();
  try {
    await p.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};});
    await p.getByRole('checkbox',{name:'裁切'}).check();
    await p.getByText('進度尚未儲存，關閉後可能遺失。').waitFor();
  } finally {await p.close();}
});
