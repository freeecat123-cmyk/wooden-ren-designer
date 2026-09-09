import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";

const base = process.argv[2] ?? "http://127.0.0.1:3120";
const browser = await chromium.launch();
const report = [];
try {
  for (const locale of (process.env.STUDIO_LOCALES ?? "zh-TW,en").split(",")) {
    const context = await browser.newContext();
    for (const width of (process.env.STUDIO_WIDTHS ?? "1440,1280,768,390,360").split(",").map(Number)) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
      await page.goto(`${base}${locale === "en" ? "/en" : ""}/design/workbench`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const canvas = page.locator("canvas");
      await canvas.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => {
        const canvas = document.querySelector("canvas");
        return canvas && canvas.width > 100 && canvas.height > 100;
      });
      // Canvas mounting precedes asynchronous geometry and texture uploads.
      let before;
      let wood = 0;
      const paintDeadline = Date.now() + 60000;
      do {
        before = await canvas.screenshot();
        const { data, info } = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        wood = 0;
        for (let i = 0; i < data.length; i += info.channels) if (data[i] > data[i + 2] + 12 && data[i + 1] > data[i + 2] + 5) wood++;
        if (wood > 300) break;
        await page.waitForTimeout(200);
      } while (Date.now() < paintDeadline);
      if (wood <= 300) await page.screenshot({ path: `/tmp/studio-failed-${locale}-${width}.png` });
      assert(wood > 300, `${locale}/${width}: no visible wood (${wood} pixels)`);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55, { steps: 12 });
      await page.mouse.up();
      const after = await canvas.screenshot();
      assert(!before.equals(after), `${locale}/${width}: rotation did not repaint`);
      const primary = await canvas.elementHandle();
      assert.equal(await canvas.count(), 1);
      assert.equal(await page.locator("form[data-design-form]").count(), 1);
      for (const name of locale === "en" ? ["Drawings", "Materials", "Build", "Quote", "Design"] : ["圖面", "材料", "製作", "報價", "設計"]) {
        console.error(`${locale}/${width}: opening ${name}`);
        await page.getByRole("tab", { name, exact: true }).click();
        await page.waitForFunction(label => Array.from(document.querySelectorAll('[role="tab"]'))
          .some(tab => tab.textContent === label && tab.getAttribute("aria-selected") === "true"), name);
      }
      await canvas.waitFor({ state: "visible" });
      assert(await primary.evaluate(node => node === document.querySelector("canvas")));
      /*
       * 🩸 材料頁的匯出區壓穿到材料表上，兩層互相透出（木頭仁 2026-09-09「背景是破的」）。
       *    根因：`.modelPanel` 寫死高度，但它裡面的 [data-studio-exports] 高度會變 ——
       *    免費版只有一行升級連結，有權限時多出 STL / OBJ / 3MF / 零件輪廓 ZIP／樣板列印
       *    兩三排，實測 317px，面板死高 360px ⇒ 溢出 260px、跟材料表疊 244px。
       * ⚠️ 這支探針沒有登入，看不到那幾排按鈕 ⇒ 直接**注入 220px 假內容**，
       *    測的是「匯出區長高時面板會不會被撐開」，比驗現況嚴格。
       */
      await page.getByRole("tab", { name: locale === "en" ? "Materials" : "材料", exact: true }).click();
      await page.waitForTimeout(600);
      const spill = await page.evaluate(() => {
        const exports = document.querySelector("[data-studio-exports]");
        const panel = exports && exports.closest("[class*=modelPanel]");
        if (!exports || !panel) return { skipped: true };
        /* 折疊起來的話高度不計，撐不撐得開就測不出來 ⇒ 先展開。 */
        if (exports.tagName === "DETAILS") exports.open = true;
        const probe = document.createElement("div");
        probe.style.height = "220px";
        probe.dataset.spillProbe = "1";
        exports.appendChild(probe);
        const value = Math.round(exports.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom);
        probe.remove();
        return { skipped: false, value };
      });
      assert(spill.skipped || spill.value <= 2,
        `${locale}/${width}: 匯出區多 220px 內容就溢出 3D 面板 ${spill.value}px → 會壓在材料表上，兩層互相透出`);
      /*
       * ⚠️ 有輸出權限時那塊是 <details>（可折疊），沒權限時是 <div>。探針沒登入 ⇒
       *    永遠只看得到 div 版本，details 那條路等於沒守到。所以直接塞一個假的
       *    <details> 進去，驗依賴的兩條 CSS 是不是真的用 `> *` 而不是 `> div`：
       *    寫成 `> div` 的話 details 不會 flex-shrink:0，參數面板打開時也不會被收起來。
       */
      const detailsRules = await page.evaluate(() => {
        const host = document.querySelector("[data-studio-model]");
        if (!host) return { skipped: true };
        const probe = document.createElement("details");
        probe.innerHTML = "<summary>probe</summary><p>x</p>";
        host.appendChild(probe);
        const shrink = getComputedStyle(probe).flexShrink;
        probe.remove();
        return { skipped: false, shrink };
      });
      assert(detailsRules.skipped || detailsRules.shrink === "0",
        `${locale}/${width}: <details> 版的輸出區沒被 flex 規則涵蓋（flex-shrink=${detailsRules.shrink}）→ 那兩條 CSS 還寫成 \`> div\``);
      await page.getByRole("tab", { name: locale === "en" ? "Design" : "設計", exact: true }).click();
      await page.waitForTimeout(400);

      const trigger = page.getByRole("button", { name: locale === "en" ? "Toggle parameters" : "切換參數面板", exact: true });
      let sheetBand = null, bandBefore = null;
      if (width < 768) {
        await trigger.click();
        /*
         * 🩸 手機版:參數面板一打開,3D 整片被蓋掉(實測看得到的高度 444px → 0px），
         *    改個尺寸完全看不到結果 —— 木頭仁 2026-09-09 回報。
         *
         * ⚠️ 不可以用 elementFromPoint 判「有沒有被蓋住」：面板是 modal <dialog>，
         *    開著時整頁 inert，那個 API 對**整個畫面**都回傳 dialog，即使該處看得到 3D。
         *    要用幾何：畫布頂 → 面板頂 之間才是真的看得到的帶。
         */
        await page.waitForTimeout(400);
        sheetBand = await page.evaluate(() => {
          const c = document.querySelector("canvas");
          const d = document.querySelector('dialog[data-studio-panel="parameters"]');
          const cb = c.getBoundingClientRect();
          const db = d && d.hasAttribute("open") ? d.getBoundingClientRect() : null;
          const vh = window.innerHeight;
          const top = Math.max(0, cb.top);
          const bottom = Math.min(db ? db.top : vh, cb.bottom, vh);
          return { vh,
            band: Math.max(0, Math.round(bottom - top)),
            left: Math.round(cb.left), width: Math.round(cb.width), top: Math.round(top),
            backdrop: d ? getComputedStyle(d, "::backdrop").backgroundColor : "none" };
        });
        assert(sheetBand.band >= sheetBand.vh * 0.25,
          `${locale}/${width}: 參數面板打開時只看得到 ${sheetBand.band}px 的 3D（視窗 ${sheetBand.vh}），要 ≥ 25%`);
        assert(/rgba\(0, 0, 0, 0\)|transparent/.test(sheetBand.backdrop),
          `${locale}/${width}: 面板的背景幕不是透明的（${sheetBand.backdrop}）→ 上面那條 3D 會被灰幕蓋住`);
        bandBefore = await page.screenshot({ clip: { x: sheetBand.left, y: sheetBand.top, width: sheetBand.width, height: sheetBand.band } });
      }
      const parameterPanel = page.locator('[data-studio-panel="parameters"]');
      assert(await parameterPanel.isVisible());
      if (locale === "zh-TW") {
        const length = parameterPanel.locator('input[name="length"]').first();
        await length.fill("1700");
        await length.blur();
        await page.waitForFunction(() => JSON.parse(document.querySelector('form[data-design-form]').dataset.designBaseline).length === 1700);
        assert.equal(await length.inputValue(), "1700");
        /* ⭐ 他要的是「即時看到改變」——所以還要證明改完之後那條 3D 真的重畫了。 */
        if (width < 768 && bandBefore) {
          await page.waitForTimeout(1500);
          const bandAfter = await page.screenshot({ clip: { x: sheetBand.left, y: sheetBand.top, width: sheetBand.width, height: sheetBand.band } });
          const [A, B] = await Promise.all([sharp(bandBefore).raw().toBuffer(), sharp(bandAfter).raw().toBuffer()]);
          let moved = 0;
          for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) > 8 || Math.abs(A[i + 1] - B[i + 1]) > 8) moved++;
          assert(moved > 500, `${locale}/${width}: 改了尺寸但看得到的那條 3D 只有 ${moved} 個像素變動 → 沒有即時更新`);
        }
      }
      if (width < 768) {
        await page.keyboard.press("Escape");
        assert(await trigger.evaluate(node => node === document.activeElement));
      }
      await page.screenshot({ path: `/tmp/studio-live-${locale}-${width}.png` });
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        elements: Array.from(document.querySelectorAll("body *")).filter(el => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 15).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })) }));
      assert(overflow.scroll <= overflow.width, `${locale}/${width}: overflow ${JSON.stringify(overflow)}`);
      assert.deepEqual(errors, [], `${locale}/${width}: browser errors`);
      report.push({ locale, width, woodPixels: wood, canvas: "nonblank, rotating, preserved", forms: 1 });
      console.error(`${locale}/${width}: passed`);
      await page.close();
    }
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
