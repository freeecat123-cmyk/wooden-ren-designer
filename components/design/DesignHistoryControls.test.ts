import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";
import { getTemplate } from "@/lib/templates";
import { parseDesignSearchParams } from "@/lib/design/parse-search-params";

const path = "/design/photo-frame";
const prefix = `wooden-ren-designer:design-history:v1:${path}:`;
const legacyQueries = ["length=180", "frameWidth=40", "joineryMode=true", "beginnerMode=false", "designerMode=true", "constructionVersion=1", "designId=old", "designId=", "unknownOption=value"];
const blankQueries = ["material=maple&audit=true", "scene=studio&wf=true", "style=shaker&styleVariant=classic", ""];
const past = [...legacyQueries, ...blankQueries].map(q => `${path}${q ? `?${q}` : ""}`);
const current = `${path}?constructionVersion=2&length=180`;
let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {DesignHistoryControls} from './components/design/DesignHistoryControls';
    const root=createRoot(document.getElementById('root'));
    window.render=()=>root.render(<DesignHistoryControls/>);
    window.render();
  ` }, bundle: true, write: false, platform: "browser", jsx: "automatic", plugins: [{ name: "history-boundaries", setup(b) {
    b.onResolve({ filter: /^(next\/navigation|next-intl)$/ }, args => ({ path: args.path, namespace: "history-test" }));
    b.onLoad({ filter: /.*/, namespace: "history-test" }, args => ({ contents: args.path === "next-intl"
      ? `export const useTranslations=()=>key=>key;`
      : `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({replace:(url,options)=>{window.navigation={url,options}; history.replaceState(null,'',url);}});` }));
  } }] });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
}, 30000);
afterAll(async () => { await browser?.close(); });

for (const savedVersion of ["2", "1", undefined]) {
  it(`rebases blank v2 history without upgrading legacy parameterized URLs (saved version ${savedVersion})`, async () => {
    const page = await browser.newPage();
    const selectedVersion = savedVersion ?? '2';
    const selectedCurrent = current.replace('constructionVersion=2', `constructionVersion=${selectedVersion}`);
    page.setDefaultTimeout(5000);
    try {
      await page.route("http://history.test/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
      await page.goto(`http://history.test${selectedCurrent}`);
      await page.evaluate(({ prefix, past, current, path }) => {
        sessionStorage.setItem(prefix + 'draft', JSON.stringify({ past, current, future: [path] }));
      }, { prefix, past, current: selectedCurrent, path });
      await page.addScriptTag({ content: bundle });
      await page.getByRole("button", { name: "undo", exact: true }).waitFor();
      await page.evaluate(version => {
        window.dispatchEvent(new CustomEvent('wooden-ren:design-saved', { detail: { id: 'saved-id', search: version ? `constructionVersion=${version}&length=180` : undefined } }));
      }, savedVersion);
      await page.waitForFunction(prefix => Boolean(sessionStorage.getItem(prefix + 'saved-id')), prefix);
      const rebased = await page.evaluate(prefix => JSON.parse(sessionStorage.getItem(prefix + 'saved-id')!), prefix) as {past: string[]; current: string; future: string[]};
      expect(rebased.past).toHaveLength(past.length);
      for (const [index, target] of rebased.past.entries()) {
        const query = new URL(target, 'http://history.test').searchParams;
        expect(query.get('designId')).toBe('saved-id');
        const expected = index < legacyQueries.length || savedVersion === undefined ? '1' : '2';
        expect(parseDesignSearchParams(Object.fromEntries(query), getTemplate('photo-frame')!).options.constructionVersion, past[index]).toBe(expected);
      }
      expect(new URL(rebased.future[0], 'http://history.test').searchParams.get('constructionVersion')).toBe(savedVersion !== undefined ? '2' : null);
      // Undo/redo keep the current saved revision, not a revision archived in history.
      await page.evaluate(version => {
        history.replaceState(null, '', `?constructionVersion=${version}&designId=saved-id&length=180&revision=fresh`);
        (window as any).render();
      }, selectedVersion);
      await page.waitForTimeout(50);
      await page.getByRole('button', { name: 'undo', exact: true }).click();
      expect(new URL(page.url()).searchParams.get('constructionVersion')).toBe(savedVersion !== undefined ? '2' : null);
      expect(new URL(page.url()).searchParams.get('revision')).toBe('fresh');
      await page.getByRole('button', { name: 'redo', exact: true }).click();
      expect(new URL(page.url()).searchParams.get('constructionVersion')).toBe(selectedVersion);
    } finally { await page.close(); }
  });
}
