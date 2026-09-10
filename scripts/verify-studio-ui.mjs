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
      for (const name of locale === "en" ? ["Drawings", "Materials", "Build", "Quote", "Export", "Design"] : ["圖面", "材料", "製作", "報價", "輸出", "設計"]) {
        console.error(`${locale}/${width}: opening ${name}`);
        await page.getByRole("tab", { name, exact: true }).click();
        await page.waitForFunction(label => Array.from(document.querySelectorAll('[role="tab"]'))
          .some(tab => tab.textContent === label && tab.getAttribute("aria-selected") === "true"), name);
      }
      await canvas.waitFor({ state: "visible" });
      assert(await primary.evaluate(node => node === document.querySelector("canvas")));
      /*
       * 🩸 輸出區原本掛在 3D 面板裡，而面板高度是寫死的 ⇒ 有輸出權限時那幾排按鈕
       *    溢出 260px、壓在材料表上，兩層互相透出（木頭仁 2026-09-09「背景是破的」）。
       *    現在它搬到自己的「輸出」分頁了 ⇒ 守的是「不准再搬回 3D 面板裡」，
       *    這比守面板高度更根本：只要不在裡面，面板高度怎麼變都壓不到別人。
       */
      await page.getByRole("tab", { name: locale === "en" ? "Export" : "輸出", exact: true }).click();
      await page.waitForTimeout(600);
      const exportsHome = await page.evaluate(() => {
        const node = document.querySelector("[data-studio-exports]");
        if (!node) return { missing: true };
        return {
          missing: false,
          inModelPanel: !!node.closest("[class*=modelPanel]"),
          inOwnTab: !!node.closest('[id$="-view-exports"]'),
          guardHook: !!node.closest("[data-studio-output]"),
        };
      });
      assert(!exportsHome.missing, `${locale}/${width}: 「輸出」分頁裡找不到輸出區`);
      assert(!exportsHome.inModelPanel,
        `${locale}/${width}: 輸出區又被放回 3D 面板裡了 → 面板高度一寫死就會壓穿材料表`);
      assert(exportsHome.inOwnTab, `${locale}/${width}: 輸出區不在「輸出」分頁的面板內`);
      /* StudioActionGuard 靠這個屬性攔「改完參數還沒套用就點輸出」，搬家時不能弄丟。 */
      assert(exportsHome.guardHook, `${locale}/${width}: 輸出區掉了 data-studio-output → 未套用的改動攔不住`);
      await page.getByRole("tab", { name: locale === "en" ? "Design" : "設計", exact: true }).click();
      await page.waitForTimeout(400);

      /*
       * 🩸 分頁列最左邊那顆「切換參數面板」的第一件事是 setView("design")，等於
       *    「切到設計分頁 + 開參數」，跟緊鄰的「設計」分頁看起來在做同一件事 ——
       *    木頭仁 2026-09-09「設計跟這個按鈕感覺重疊了,左邊的按鈕根本沒必要」。
       * ⇒ 手機不放它，參數入口改成設計分頁裡的「調整參數」。桌機保留（那裡是折疊側欄）。
       */
      const paletteButtons = await page.evaluate(() =>
        [...document.querySelectorAll("[class*=navigation] > button")].map(node => node.getAttribute("aria-label")));
      const toggleName = locale === "en" ? "Toggle parameters" : "切換參數面板";
      if (width < 768) assert(!paletteButtons.includes(toggleName),
        `${locale}/${width}: 手機分頁列又放回參數鈕了 → 跟隔壁的「設計」分頁重疊（${paletteButtons.join(" / ")}）`);
      else assert(paletteButtons.includes(toggleName),
        `${locale}/${width}: 桌機分頁列少了折疊參數側欄的按鈕（${paletteButtons.join(" / ")}）`);
      const trigger = width < 768
        ? page.getByRole("button", { name: locale === "en" ? "Adjust parameters" : "調整參數", exact: true })
        : page.getByRole("button", { name: toggleName, exact: true });
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
  /*
   * 🩸 手機上改尺寸只能打字，一打字鍵盤就彈出來蓋掉 3D，等於看不到改了什麼 ——
   *    木頭仁 2026-09-10「還是之前的做法比較好:左右增加按鈕,可以加跟減」。
   *    兩顆鈕本來就寫好了，只是 (a) 一般數字欄位沒開 showPlusMinus、
   *    (b) 開了的也被 `hidden md:flex` 藏起來，手機一律看不到。
   * ⚠️ 要用「有觸控」的 context 才測得出雙觸發：onMouseDown + onTouchStart 兩個都綁的話，
   *    tap 一次會走兩步（實測 step=10 的欄位從 1800 跳到 1820）。
   */
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const tp = await touch.newPage();
  tp.setDefaultTimeout(60000);
  await tp.goto(`${base}/design/workbench`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await tp.locator("canvas").first().waitFor({ timeout: 60000 });
  await tp.waitForTimeout(3000);
  await tp.locator("[data-parameter-cta]").click();
  await tp.waitForTimeout(800);
  const panel = 'dialog[data-studio-panel="parameters"]';
  /*
   * ⚠️ 面板裡的分組是收合的 <details>，收合組裡的按鈕 checkVisibility() 本來就是 false。
   *    所以不能整包數，要逐欄位比：**每個看得到的數字欄位，都要有兩顆看得到的 ±**。
   */
  const steppers = await tp.evaluate(sel => {
    const labels = ["減", "加", "Decrease", "Increase"];
    const fields = [...document.querySelectorAll(`${sel} input[type=number]`)]
      .filter(i => !i.classList.contains("sr-only") && i.checkVisibility());
    let withoutPair = 0, small = 0;
    for (const input of fields) {
      const row = input.closest("label") ?? input.parentElement;
      const pair = [...row.querySelectorAll("button[aria-label]")]
        .filter(b => labels.includes(b.getAttribute("aria-label")) && b.checkVisibility());
      if (pair.length !== 2) withoutPair++;
      for (const b of pair) {
        const r = b.getBoundingClientRect();
        if (r.width < 40 || r.height < 40) small++;
      }
    }
    return { fields: fields.length, withoutPair, small };
  }, panel);
  assert(steppers.fields > 0, "手機參數面板裡找不到看得見的數字欄位");
  assert(steppers.withoutPair === 0,
    `手機上 ${steppers.fields} 個數字欄位裡有 ${steppers.withoutPair} 個沒有一對看得到的 ± → 沒開 showPlusMinus，或又被 hidden md: 藏起來了`);
  assert(steppers.small === 0, `有 ${steppers.small} 顆 ± 小於 44×44，手指按不準`);

  const lengthInput = tp.locator(`${panel} input[name="length"]`).first();
  const step = Number(await lengthInput.getAttribute("step"));
  const before = Number(await lengthInput.inputValue());
  await tp.locator(`${panel} button[aria-label="加"]`).first().tap();
  await tp.waitForTimeout(1200);
  const after = Number(await lengthInput.inputValue());
  assert(after - before === step,
    `tap 一次 + 走了 ${after - before}（step 是 ${step}）→ mouse 跟 touch 事件雙觸發，要改用 Pointer Events`);
  /* 重點是「不用叫鍵盤」⇒ 按 ± 不可以讓數字框拿到焦點。 */
  assert(!(await tp.evaluate(() => document.activeElement?.tagName === "INPUT" && document.activeElement?.type === "number")),
    "按 ± 之後數字框拿到焦點了 → 手機會彈出鍵盤，又把 3D 蓋掉");
  console.error("stepper: passed");
  await touch.close();

  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
