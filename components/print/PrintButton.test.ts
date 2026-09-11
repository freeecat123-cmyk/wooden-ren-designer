import { beforeAll, afterAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {PrintButton} from './components/print/PrintButton';
    window.printCount=0; window.print=()=>{window.printCount++;window.dispatchEvent(new Event('afterprint'));};
    createRoot(document.getElementById('root')).render(<PrintButton suggestedFilename="test-design" preflight={window.noPreflight ? undefined : {name:'測試桌',size:'900 × 600 × 750 mm',savedState:'changed',warnings:['桌面超出建議範圍'],hasTemplates:true}}/>);
  `}, bundle:true, write:false, platform:'browser', jsx:'automatic', plugins:[{name:'locale',setup(b){
    b.onResolve({filter:/^next-intl$/},()=>({path:'locale',namespace:'stub'}));
    b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const useLocale=()=>"zh-TW";'}));
  }}] });
  bundle=result.outputFiles[0].text; browser=await chromium.launch();
});

it('waits for fonts and preserves direct printing for existing quote callers',async()=>{
  const p=await browser.newPage();
  try {
    await p.setContent('<div id="root"></div>');
    await p.evaluate(()=>{(window as any).noPreflight=true;(window as any).fontsReady=false;Object.defineProperty(document.fonts,'status',{get:()=> (window as any).fontsReady?'loaded':'loading'});});
    await p.addScriptTag({content:bundle});
    expect(await p.getByRole('button',{name:'準備列印中'}).isDisabled()).toBe(true);
    await p.evaluate(()=>{(window as any).fontsReady=true;});
    await p.getByRole('button',{name:'列印 / 存成 PDF',exact:true}).click();
    await p.waitForFunction(()=>(window as any).printCount===1);
    expect(await p.getByRole('dialog').count()).toBe(0);
  } finally {await p.close();}
});
afterAll(async()=>browser?.close());

it('requires explicit confirmation and presents warnings, save state and scale distinction',async()=>{
  const p=await browser.newPage({viewport:{width:390,height:844}});
  try {
    await p.setContent('<title>Original</title><div id="root"></div>');await p.addScriptTag({content:bundle});
    await p.getByRole('button',{name:'列印 / 存成 PDF',exact:true}).click();
    const dialog=p.getByRole('dialog');await dialog.waitFor();
    expect(await dialog.getByText('測試桌').isVisible()).toBe(true);
    expect(await dialog.getByText('目前輸出與雲端儲存內容不同。').isVisible()).toBe(true);
    expect(await dialog.getByText('桌面超出建議範圍').isVisible()).toBe(true);
    expect(await dialog.getByText('1:1',{exact:false}).count()).toBeGreaterThan(0);
    expect(await p.evaluate(()=>(window as any).printCount)).toBe(0);
    await dialog.getByRole('button',{name:'確認列印'}).click();
    await p.waitForFunction(()=>(window as any).printCount===1);
    expect(await p.title()).toBe('Original');
    expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  }finally{await p.close();}
});

it('blocks while images are loading and permits retry after a broken image is repaired',async()=>{
  const p=await browser.newPage();
  try {
    await p.route('http://print.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div><img src="/missing.png">'}));
    let release: (()=>void)|undefined;
    await p.route('**/missing.png',async r=>{await new Promise<void>(resolve=>{release=resolve;});await r.fulfill({status:404,body:''});});
    await p.goto('http://print.test/',{waitUntil:'domcontentloaded'});await p.addScriptTag({content:bundle});
    expect(await p.getByRole('button',{name:'準備列印中'}).isDisabled()).toBe(true);
    release!();
    await p.getByText('圖片或字型尚未就緒，請重試。').waitFor();
    expect(await p.evaluate(()=>(window as any).printCount)).toBe(0);
    await p.evaluate(()=>{document.querySelector('img')!.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';});
    await p.getByRole('button',{name:'重新檢查'}).click();
    await p.getByRole('button',{name:'列印 / 存成 PDF',exact:true}).waitFor();
  }finally{await p.close();}
});
