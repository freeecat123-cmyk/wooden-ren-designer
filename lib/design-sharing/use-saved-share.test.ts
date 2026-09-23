import { expect, it } from "vitest";
import { build } from "esbuild";
import { chromium } from "playwright";

it("isolates pending inputs by design identity but retains dirtiness during save catch-up", async () => {
  const bundle = await build({ stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {flushSync} from 'react-dom';
    import {useSavedShare} from './lib/design-sharing/use-saved-share';
    const root = createRoot(document.getElementById('root'));
    function Probe(props) { const state = useSavedShare(props.id, props.revision, false);
      return <><form data-design-form><input name="length" defaultValue="300"/></form><output>{JSON.stringify(state)}</output></>; }
    window.render = (id, revision) => flushSync(() => root.render(<Probe id={id} revision={revision}/>));
    window.render('A', 'a1');
  `, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.goto("http://share.test/?length=300");
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const state = async () => JSON.parse((await page.locator("output").textContent())!);
    const render = (id: string, revision: string) => page.evaluate(([id, revision]) => (window as any).render(id, revision), [id, revision]);
    const save = (id: string, revision: string) => page.evaluate(([id, revision]) => window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { id, revision, fingerprint: "signed", search: "length=300" } })), [id, revision]);
    await page.locator("input").fill("301");
    await render("A", "a1");
    expect((await state()).dirty).toBe(true);
    await render("B", "b1");
    await expect.poll(state).toEqual({ designId: "B", revision: "b1", dirty: false });
    await save("B", "b2");
    await expect.poll(state).toEqual({ designId: "B", revision: "b2", dirty: false });
    await page.locator("input").fill("302");
    await page.evaluate(() => history.replaceState(null, "", "?length=300&scene=studio"));
    await render("B", "b2");
    expect((await state()).dirty).toBe(true);
    // A save-as response may arrive before its new ID props. Later edits survive catch-up.
    await render("C", "c1");
    await save("D", "d1");
    await page.locator("input").fill("303");
    await render("D", "d1");
    expect((await state()).dirty).toBe(true);
  } finally { await browser.close(); }
}, 30000);
