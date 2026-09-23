import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { chromium } from "playwright";
import { expect, it } from "vitest";

it("filters capability URLs through the Analytics component mounted by the layout", async () => {
  const layout = readFileSync("app/[locale]/layout.tsx", "utf8");
  const imported = layout.match(/import \{ (\w*Analytics) \} from "([^"]+)"/)!;
  expect(layout).toContain(`<${imported[1]} />`);
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {${imported[1]} as Analytics} from '${imported[2]}';
      createRoot(document.getElementById('root')).render(<Analytics/>);
    ` },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "navigation", setup(b) {
      b.onResolve({ filter: /^next\/navigation(?:\.js)?$/ }, () => ({ path: "navigation", namespace: "mock" }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: `
        export const usePathname=()=>location.pathname;
        export const useSearchParams=()=>new URLSearchParams(location.search);
        export const useParams=()=>({});
      ` }));
    } }],
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.fulfill({
      contentType: route.request().resourceType() === "script" ? "application/javascript" : "text/html",
      body: route.request().resourceType() === "script" ? "" : '<div id="root"></div>',
    }));
    const token = "synthetic-capability-token-not-a-real-publication";
    await page.goto(`http://analytics.test/shared-design/${token}`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForFunction(() => (window as any).vaq?.some(([kind]: string[]) => kind === "pageview"));
    const results = await page.evaluate(token => {
      const queue = (window as any).vaq as [string, any][];
      const filter = queue.find(([kind]) => kind === "beforeSend")?.[1] ?? ((event: unknown) => event);
      const initial = filter({ type: "pageview", url: location.href });
      history.replaceState(null, "", "/design/photo-frame");
      const shared = ["", "/en", "/zh-TW"].flatMap(locale =>
        ["pageview", "event"].map(type => filter({ type, url: `${location.origin}${locale}/shared-design/${token}?source=test#view` })));
      const normal = ["pageview", "event"].map(type => {
        const event = { type, url: `${location.origin}/en/design/photo-frame?length=180` };
        return filter(event) === event;
      });
      history.replaceState(null, "", `/en/shared-design/${token}`);
      const navigated = filter({ type: "event", url: `${location.origin}/en/design/photo-frame` });
      return { initial, shared, normal, navigated };
    }, token);
    expect(results.initial, "direct shared-page load").toBeNull();
    expect(results.shared, "including delayed events after leaving the shared page").toEqual(Array(6).fill(null));
    expect(results.normal).toEqual([true, true]);
    expect(results.navigated, "SPA navigation is checked at send time").toBeNull();
  } finally { await browser.close(); }
}, 30000);
