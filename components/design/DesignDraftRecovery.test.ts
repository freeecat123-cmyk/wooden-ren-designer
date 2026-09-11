import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";

let browser: Browser;
let bundle: string;
beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {DesignDraftRecovery} from './components/design/DesignDraftRecovery';
      const root=createRoot(document.getElementById('root'));
      window.render=()=>root.render(<DesignDraftRecovery/>); window.render();
    ` }, bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "draft-boundaries", setup(b) {
      const stubs: Record<string, string> = {
        "next/navigation": `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({replace:url=>{history.replaceState(null,'',url);window.render();}});`,
        "next-intl": `export const useLocale=()=>"zh-TW";`,
        "@/hooks/useUserPlan": `export const useUserPlan=()=>({userId:'owner',isLoading:false});`,
      };
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: "stub" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "stub" }, a => ({ contents: stubs[a.path] }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch();
});
afterAll(async () => browser?.close());

it("backs up edits with a timestamp, restores after reopening, and clears only a matching cloud save", async () => {
  const page = await browser.newPage();
  try {
    await page.route("http://draft.test/**", r => r.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.goto("http://draft.test/design/photo-frame?designId=a&revision=old&length=300");
    await page.addScriptTag({ content: bundle }); await page.waitForTimeout(100);
    await page.evaluate(() => { history.replaceState(null, "", "?designId=a&revision=old&length=450"); (window as any).render(); });
    await page.getByText("草稿已備份在此裝置", { exact: false }).waitFor();
    expect(await page.locator("time").getAttribute("datetime")).toBeTruthy();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { search: "designId=a&length=300" } })));
    expect(await page.locator("time").count()).toBe(1);
    await page.goto("http://draft.test/design/photo-frame?designId=a&revision=new&length=300");
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "恢復草稿" }).click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get("length") === "450");
    expect(new URL(page.url()).searchParams.get("revision")).toBe("old");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { search: location.search } })));
    await page.waitForFunction(() => !document.querySelector('[role="status"]'));
  } finally { await page.close(); }
});

it("never reports a successful device backup when browser storage fails", async () => {
  const page = await browser.newPage();
  try {
    await page.route("http://draft.test/**", r => r.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.goto("http://draft.test/design/photo-frame?length=300");
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("quota"); }; });
    await page.addScriptTag({ content: bundle }); await page.waitForTimeout(100);
    await page.evaluate(() => { history.replaceState(null, "", "?length=450"); (window as any).render(); });
    await page.getByText("此裝置暫時無法備份草稿。").waitFor();
    expect(await page.locator("time").count()).toBe(0);
  } finally { await page.close(); }
});

it("retains a revert to the original value when an older in-flight edit reached the cloud", async () => {
  const page = await browser.newPage();
  try {
    await page.route("http://draft.test/**", r => r.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.goto("http://draft.test/design/photo-frame?designId=a&length=300");
    await page.addScriptTag({ content: bundle }); await page.waitForTimeout(100);
    await page.evaluate(() => { history.replaceState(null, "", "?designId=a&length=450"); (window as any).render(); });
    await page.getByText("草稿已備份在此裝置", { exact: false }).waitFor();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { search: "designId=a&length=400" } }));
      history.replaceState(null, "", "?designId=a&length=300"); (window as any).render();
    });
    await page.waitForTimeout(100);
    const raw = await page.evaluate(() => localStorage.getItem("wooden-ren:draft:v1:owner:/design/photo-frame:a"));
    expect(raw).not.toBeNull();
    expect(new URLSearchParams(JSON.parse(raw!).search).get("length")).toBe("300");
  } finally { await page.close(); }
});
