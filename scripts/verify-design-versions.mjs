import { build } from "esbuild";
import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(".next/dev/static/css/app/[locale]/layout.css", "utf8");

// Exercise the real component with deterministic auth-independent API responses.
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {DesignVersions} from './components/design/DesignVersions'; createRoot(document.getElementById('root')).render(<DesignVersions designId="11111111-1111-1111-1111-111111111111" revision="2026-09-05T10:00:00Z" disabled={false} hasChanges={true}/>);`, loader: "tsx", resolveDir: process.cwd() },
  bundle: true, write: false, format: "iife", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "fixture-hooks", setup(builder) {
    builder.onResolve({ filter: /^next-intl$|^next\/navigation$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "next-intl" ? 'export const useLocale=()=>"zh-TW";' : 'export const usePathname=()=>"/design/stool";' }));
  } }],
});
const browser = await chromium.launch();
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(mobile ? devices["iPhone 13"] : { viewport: { width: 1440, height: 900 } });
    let restores = 0;
    const page = await context.newPage();
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/versions")) {
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON();
          assert.equal(body.expectedUpdatedAt, "2026-09-05T10:00:00Z");
          assert.equal(body.versionId, "version-0");
          restores++;
          return route.fulfill({ status: restores === 1 ? 409 : 200, json: restores === 1 ? { error: "design_conflict" } : { id: "restored" } });
        }
        const offset = Number(url.searchParams.get("offset"));
        return route.fulfill({ json: { versions: Array.from({ length: offset ? 1 : 20 }, (_, i) => ({ id: `version-${offset + i}`, name: `Design ${offset + i}`, params: { length: 900, width: 400, height: 600 }, created_at: "2026-09-04T10:00:00Z" })), hasMore: offset === 0 } });
      }
      if (url.searchParams.get("loadSaved")) return route.fulfill({ contentType: "text/html", body: "Restored design" });
      return route.fulfill({ contentType: "text/html", body: `<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles[0].text}</script></html>` });
    });
    await page.goto("http://versions.test/");
    await page.getByRole("button", { name: "歷史版本", exact: true }).click();
    await page.getByRole("button", { name: "載入更多" }).click();
    await page.getByText("Design 20", { exact: true }).waitFor();
    await page.getByText("Design 0", { exact: true }).click();
    await page.getByText("目前尚未儲存的修改會被取代", { exact: false }).waitFor();
    await page.screenshot({ path: `/tmp/design-versions-${mobile ? "mobile" : "desktop"}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", { name: "還原此版本" }).click();
    await page.getByRole("alert").getByText("雲端設計已有更新", { exact: false }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/");
    await page.getByRole("button", { name: "還原此版本" }).click();
    await page.getByText("Restored design", { exact: true }).waitFor();
    assert.equal(restores, 2);
    console.log(`${mobile ? "Mobile" : "Desktop"}: pagination, unsaved warning, conflict and restore navigation passed`);
    await context.close();
  }
} finally { await browser.close(); }
