/**
 * 木頭仁工具 · EasyStore 商店前台小工具
 *
 * 用法：在 EasyStore 佈景主題 主題.liquid 的 </body> 前貼「一行」：
 *
 *   <script src="https://designer.woodenren.com/widget/easystore-shop.js" defer></script>
 *
 * 功能：
 *   1) 免運進度條（左下角浮動）— 讀 /cart.json，購物車有商品時顯示，
 *      目標金額 = 超商免運門檻 SHIP_THRESHOLD。
 *   2) 商品頁配送說明 — 在「加入購物車」按鈕下方插入配送/出貨資訊框。
 *
 * 為什麼用外部檔：EasyStore 程式碼編輯器貼太長的內容會「吃字」導致語法錯誤，
 * 改成外部檔後編輯器只放一行 <script src>，永遠不會被截斷；要改文案/門檻
 * 直接改這個檔、重新部署即可，不必再貼進後台。
 *
 * Self-contained：不依賴任何外部 lib，樣式 inline 避免衝突。
 */
(function () {
  if (window.__wrShopWidgetLoaded) return;
  window.__wrShopWidgetLoaded = true;
  window.__wrShopWidgetVersion = "2026-10-24-seo"; // 換版辨識用（curl 線上檔 grep 這串）

  // 2026-10-24 佈景主題每頁都宣告 <html lang="en">，內容是繁中 ⇒ 先在 JS 改成 zh-Hant-TW。
  // 這是治標：Google 會跑 JS 看得到，不跑 JS 的爬蟲還是看到 en；治本是後台語言設定／主題 layout 檔。
  // 只有 lang 是空的或 en 開頭才改（哪天開英文版 /en/ 路徑就不動）。
  (function fixLang() {
    try {
      var de = document.documentElement;
      var cur = (de.getAttribute("lang") || "").toLowerCase();
      if (/^\/en(\/|$)/.test(location.pathname)) return;
      if (!cur || cur.indexOf("en") === 0) de.setAttribute("lang", "zh-Hant-TW");
    } catch (e) {}
  })();

  // 2026-10-24 課程商品頁（木匠學院）專用：只認這一個商品網址
  var COURSE_HANDLE = "木匠學院-系統化的線上木工課程";
  function isCoursePage() {
    var p = location.pathname;
    try { p = decodeURIComponent(p); } catch (e) {}
    var m = /\/products\/([^\/]+)\/?$/.exec(p);
    return !!m && m[1] === COURSE_HANDLE;
  }

  // 2026-10-15 頂部公告列是佈景主題設定（沒有 API），活動改了先在這裡換字：
  // 岩崎握把活動＝官網買 1 支就送原廠木握把、滿 4 支升級紅木握把。後台改掉舊字後這段找不到就不做事。
  (function fixAnnouncement() {
    var OLD = "官網一次買滿 4 支銼刀，送原廠木握把";
    var NEW = "官網買 1 支就送原廠木握把，滿 4 支升級紅木握把";
    var bars = document.querySelectorAll('[id^="announcement_bar_"]');
    for (var i = 0; i < bars.length; i++) {
      for (var n = bars[i].firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.nodeValue.indexOf(OLD) !== -1) n.nodeValue = n.nodeValue.replace(OLD, NEW);
      }
    }
  })();

  // 2026-10-15 佈景主題 </body> 前殘留一段舊版進度條程式碼，開頭的 <script> 被編輯器吃掉，
  // 整段變成文字露在每頁最底下（字串裡的 HTML 還被解析成元素，id 會跟本檔的 #wr-ship-* 撞名）。
  // 後台刪掉前先在這裡清：從含「var THRESHOLD」的文字節點刪到「addShipInfo(); })();」為止。
  // 後台刪乾淨後這段找不到起點就什麼都不做。
  (function removeLeakedThemeCode() {
    var nodes = document.body ? Array.prototype.slice.call(document.body.childNodes) : [];
    var start = -1;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === 3 && nodes[i].nodeValue.indexOf("var THRESHOLD") !== -1) { start = i; break; }
    }
    if (start < 0) return;
    for (var j = start; j < nodes.length; j++) {
      var n = nodes[j];
      if (n.nodeType === 1 && n.tagName === "SCRIPT") break;
      var t = n.textContent || "";
      if (n.parentNode) n.parentNode.removeChild(n);
      if (n.nodeType === 3 && /addShipInfo\(\);\s*\}\)\(\);/.test(t)) break;
    }
  })();

  // ====== 可調參數 ======
  var SHIP_THRESHOLD = 1500; // 進度條目標＝超商免運門檻
  // ======================

  function injectStyle() {
    if (document.getElementById("wr-shop-style")) return;
    var st = document.createElement("style");
    st.id = "wr-shop-style";
    st.textContent = [
      "#wr-ship-bar{position:fixed;left:18px;bottom:18px;z-index:9998;width:240px;",
      "background:#fff;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.18);",
      "padding:10px 14px;font-family:inherit;font-size:13px;color:#3a3a3a;",
      "border:1px solid #eee;text-decoration:none;display:none}",
      "#wr-ship-bar .wr-msg{font-weight:600;margin-bottom:7px;line-height:1.35}",
      "#wr-ship-bar .wr-msg b{color:#A47A64}",
      "#wr-ship-bar.done .wr-msg{color:#06893a}",
      "#wr-ship-track{height:7px;border-radius:5px;background:#ede7e3;overflow:hidden}",
      "#wr-ship-fill{height:100%;border-radius:5px;background:#A47A64;width:0;transition:width .4s ease}",
      "#wr-ship-bar.done #wr-ship-fill{background:#23c552}",
      "#wr-ship-info{margin:16px 0;padding:14px 16px;border:1px solid #e7ddd5;border-radius:10px;",
      "background:#faf6f2;font-size:14px;line-height:1.9;color:#4a4038;font-family:inherit}",
      "@media(max-width:600px){#wr-ship-bar{width:200px;left:10px;bottom:10px}}",
      // 頂部公告條
      "#wr-annc{background:#A47A64;color:#fff;font-size:13px;font-weight:600;text-align:center;",
      "padding:8px 12px;font-family:inherit;letter-spacing:.3px;transition:opacity .25s}",
      // 信任徽章
      "#wr-badges{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0;font-family:inherit}",
      "#wr-badges .wr-bdg{flex:1 1 40%;min-width:120px;display:flex;align-items:center;gap:6px;",
      "background:#f6f1ec;border:1px solid #ece2d8;border-radius:8px;padding:8px 10px;",
      "font-size:13px;color:#4a4038;font-weight:600}#wr-badges .wr-bdg span{font-size:16px}",
      // 手機吸底加入購物車
      "#wr-sticky-atc{position:fixed;left:0;right:0;bottom:0;z-index:10000;display:none;",
      "align-items:center;gap:10px;padding:8px 12px;background:#fff;border-top:1px solid #e7ddd5;",
      "box-shadow:0 -3px 12px rgba(0,0,0,.12);font-family:inherit}",
      "#wr-sticky-atc .wr-pt{flex:1;min-width:0}",
      "#wr-sticky-atc .wr-pn{font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#wr-sticky-atc .wr-pp{font-size:16px;font-weight:700;color:#A47A64}",
      "#wr-sticky-atc button{flex:0 0 auto;background:#A47A64;color:#fff;border:0;border-radius:8px;",
      "padding:12px 22px;font-size:15px;font-weight:700;font-family:inherit}",
      "@media(min-width:768px){#wr-sticky-atc{display:none!important}}",
      "body.wr-sticky-on #wr-ship-bar{bottom:78px}",
      'body.wr-sticky-on a[href*="lin.ee"]{bottom:78px!important}',
      // 手機整頁左右滑：佈景主題把頁面撐到 620px 寬（手機 390px），主題自己的
      // html{overflow-x:hidden} 擋不住 iPhone 的觸控捲動。clip 不會變成捲動容器，
      // 吸頂/吸底元件照常運作。（2026-10-01 WebKit 實測：可滑出 230px → 0）
      "html,body{overflow-x:clip}",
      // 2026-10-24 課程商品頁：藏全站公告列（岩崎促銷／免運，課程用不到）；
      // 評價 0 則時藏「總分 0 - 0」與「成為首位評論者」（body class 由 courseReviews() 判斷後才加）
      "body.wr-course slider-announcement-bar-app,body.wr-course #wr-annc{display:none!important}",
      "body.wr-course-norev .es-avg-rates,body.wr-course-norev #sr-input-wrapper{display:none!important}"
    ].join("");
    document.head.appendChild(st);
  }

  // ---- 頂部公告條（可改文案：改 MSGS 陣列）----
  var ANNC_MSGS = [
    "🚚 超商滿 NT$1,500・宅配滿 NT$4,500 免運",
    "⚡ 下單後 2 個工作天內快速出貨",
    "🪵 木頭仁嚴選・職人木工工具專賣"
  ];
  function initAnnouncement() {
    if (document.getElementById("wr-annc")) return;
    var a = document.createElement("div");
    a.id = "wr-annc";
    a.textContent = ANNC_MSGS[0];
    document.body.insertBefore(a, document.body.firstChild);
    if (ANNC_MSGS.length > 1) {
      var i = 0;
      setInterval(function () {
        i = (i + 1) % ANNC_MSGS.length;
        a.style.opacity = "0";
        setTimeout(function () { a.textContent = ANNC_MSGS[i]; a.style.opacity = "1"; }, 250);
      }, 4000);
    }
  }

  // ---- 商品頁信任徽章 ----
  function addTrustBadges() {
    if (location.pathname.indexOf("/products/") < 0) return;
    if (document.getElementById("wr-badges")) return;
    var btn =
      document.getElementById("AddToCart") ||
      document.querySelector('[name="add"],button.addToCart-btn');
    if (!btn) return;
    var anchor =
      document.getElementById("wr-ship-info") || btn.closest("form") || btn.parentElement;
    var items = [
      ["✅", "正品保證"],            // 正品保證
      ["🚚", "2天快速出貨"], // 2天快速出貨
      ["🔄", "7天鑑賞期"],       // 7天鑑賞期
      ["🧾", "可開發票"]         // 可開發票
    ];
    var b = document.createElement("div");
    b.id = "wr-badges";
    b.innerHTML = items
      .map(function (it) {
        return '<div class="wr-bdg"><span>' + it[0] + "</span>" + it[1] + "</div>";
      })
      .join("");
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
  }

  // ---- 手機版吸底「加入購物車」----
  function initStickyAtc() {
    if (document.getElementById("wr-sticky-atc")) return;
    if (location.pathname.indexOf("/products/") < 0) return;
    var btn =
      document.getElementById("AddToCart") ||
      document.querySelector('[name="add"],button.addToCart-btn');
    if (!btn) return;
    var price = (document.querySelector(".money") || {}).innerText || "";
    var name = (document.querySelector("h1") || {}).innerText || "";
    var bar = document.createElement("div");
    bar.id = "wr-sticky-atc";
    bar.innerHTML =
      '<div class="wr-pt"><div class="wr-pn"></div><div class="wr-pp"></div></div>' +
      '<button type="button">加入購物車</button>'; // 加入購物車
    bar.querySelector(".wr-pn").textContent = name;
    bar.querySelector(".wr-pp").textContent = price.trim();
    bar.querySelector("button").addEventListener("click", function () { btn.click(); });
    document.body.appendChild(bar);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            var show = !e.isIntersecting && window.innerWidth < 768;
            bar.style.display = show ? "flex" : "none";
            document.body.classList.toggle("wr-sticky-on", show);
          });
        },
        { threshold: 0 }
      );
      io.observe(btn);
    }
  }

  // ---- 免運進度條 ----
  function initShipBar() {
    if (document.getElementById("wr-ship-bar")) return;
    var bar = document.createElement("a");
    bar.id = "wr-ship-bar";
    bar.href = "/cart";
    bar.innerHTML =
      '<div class="wr-msg"></div>' +
      '<div id="wr-ship-track"><div id="wr-ship-fill"></div></div>';
    document.body.appendChild(bar);

    function render() {
      fetch("/cart.json", {
        headers: { Accept: "application/json" },
        credentials: "include"
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var cart = d.cart;
          if (!cart || !cart.item_count) { bar.style.display = "none"; return; }
          bar.style.display = "block";
          var total = parseFloat(cart.total_price || "0");
          var pre = (cart.currency && cart.currency.format_prefix) || "NT$";
          var fmt = function (n) { return pre + Math.round(n).toLocaleString("en-US"); };
          var remain = SHIP_THRESHOLD - total;
          var pct = Math.min(100, (total / SHIP_THRESHOLD) * 100);
          var msg = bar.querySelector(".wr-msg");
          if (remain > 0) {
            bar.classList.remove("done");
            msg.innerHTML = "再買 <b>" + fmt(remain) + "</b> 享超商免運 🚚";
          } else {
            bar.classList.add("done");
            msg.innerHTML = "🎉 已達超商免運門檻！";
          }
          bar.querySelector("#wr-ship-fill").style.width = pct + "%";
        })
        .catch(function () {});
    }

    render();
    window.addEventListener("focus", render);
    window.addEventListener("pageshow", render);
    var t;
    document.addEventListener("click", function () {
      clearTimeout(t);
      t = setTimeout(render, 900);
    }, true);
    setInterval(render, 5000);
  }

  // ---- 商品頁配送說明 ----
  function addShipInfo() {
    if (location.pathname.indexOf("/products/") < 0) return;
    if (document.getElementById("wr-ship-info")) return;
    var btn =
      document.getElementById("AddToCart") ||
      document.querySelector('[name="add"],button.addToCart-btn');
    if (!btn) return;
    var form = btn.closest("form") || btn.parentElement;
    var box = document.createElement("div");
    box.id = "wr-ship-info";
    box.innerHTML =
      '<div style="font-weight:700;color:#A47A64;margin-bottom:6px;">🚚 配送與出貨</div>' +
      "<div>• 超商取貨 <b>NT$60</b>（滿 <b>NT$1,500</b> 免運 🎁）</div>" +
      "<div>• 宅配到府 <b>NT$120</b>（滿 <b>NT$4,500</b> 免運）</div>" +
      "<div>• 下單後 <b>2 個工作天內</b> 出貨</div>";
    form.parentNode.insertBefore(box, form.nextSibling);
  }

  // 2026-10-06：佈景主題的規格下拉選單 <select id="productSelect"> 選項文字把價格以「分」顯示（1,900 → 190,000），
  // 全站每個商品都一樣（主價格 itemprop=price 是對的）。後台佈景主題不好改 ⇒ 這裡把選項文字 ÷100。
  // 保險：只有「目前選的那個選項 ÷100 剛好等於畫面上顯示的現價」才動（哪天主題自己修好了，這段就自動不做事，不會改成錯的）。
  function fixVariantPrices() {
    var sel = document.querySelector("select#productSelect, select.product-single__variants");
    if (!sel || sel.getAttribute("data-wr-px")) return;
    // 比對畫面上顯示的現價（#ProductPrice，會跟著選的規格變）；多規格商品的 itemprop=price 是最低價，不能拿來比
    var shown = document.querySelector("#ProductPrice .money, #ProductPrice");
    var P = shown ? parseFloat(((shown.getAttribute("data-ori-price") || shown.textContent || "").match(/[\d,]+(?:\.\d+)?/) || [""])[0].replace(/,/g, "")) : NaN;
    var re = /NT\$\s?([\d,]+(?:\.\d+)?)/;
    var num = function (o) { var m = re.exec(o.textContent || ""); return m ? parseFloat(m[1].replace(/,/g, "")) : NaN; };
    var cur = sel.options[sel.selectedIndex] || sel.options[0];
    if (!cur || !isFinite(P) || !(Math.abs(num(cur) / 100 - P) < 0.01)) return;
    Array.prototype.forEach.call(sel.options, function (o) {
      var m = re.exec(o.textContent || "");
      if (!m) return;
      var n = parseFloat(m[1].replace(/,/g, "")) / 100;
      o.textContent = o.textContent.replace(m[0], "NT$ " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    });
    sel.setAttribute("data-wr-px", "1");
  }

  // ---- 2026-10-24 課程商品頁：藏公告列＋0 則評價時藏評價區 ----
  // 評價數由評價 App 用 JS 晚點填進 #starReviewCount ⇒ 每次輪詢重判，有評價就把評價區放回來。
  function courseFixes() {
    if (!isCoursePage() || !document.body) return;
    document.body.classList.add("wr-course");
    var ids = ["starReviewCount", "starReviewCountReviewSectionHeader"];
    var zero = true, seen = false;
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (!el) continue;
      seen = true;
      var n = parseInt((el.textContent || "").replace(/[^\d]/g, ""), 10);
      if (!(n === 0)) zero = false; // 讀不到數字也當「不是 0」，寧可不藏
    }
    var nz = document.getElementById("nonZeroComment");
    if (nz && nz.style.display !== "none") zero = false; // App 已顯示評價列表
    document.body.classList.toggle("wr-course-norev", seen && zero);
  }

  // ---- 2026-10-24 商品頁 JSON-LD：補 brand / mpn / 多規格 AggregateOffer ----
  // 主題只有 microdata Product（名稱、圖、最低價一個 Offer）。這裡補一個 JSON-LD Product：
  // @id＝商品網址#product、url／name 跟 microdata 完全相同，並把 microdata 的 itemid 設成同一個 @id
  // （同一個商品，不是第二個）。商品描述裡如果已經自帶 JSON-LD Product（鑿刀套裝頁），就只補它缺的欄位、不另外再加。
  // 資料來源：頁面 inline script 裡主題給 EasyStore.OptionSelectors 的商品 JSON（不是 window 變數；/products/x.json 也只回 HTML）。
  // variants[].price 以「分」計，price_min／price_max 是元；兩者對得上、且等於 microdata 價格才用。
  var BRANDS = [ // 商品名開頭（去掉【木頭仁】、日本 等前綴）→ 品牌；沒列到的不寫 brand
    [/^Shapton\b/i, "Shapton"],
    [/^岩崎/, "岩崎 Iwasaki"],
    [/^Temple Tool\b/i, "Temple Tool Co."],
    [/^(Z-Saw|Z牌|岡田)/i, "Z-Saw"],
    [/^SHINWA/i, "SHINWA"],
    [/^別所二郎/, "別所二郎"],
    [/^KING\b/i, "KING"],
    [/^PuriCurrent\b/i, "PuriCurrent"],
    [/^CO-MATIC\b/i, "CO-MATIC"],
    [/^TENZ/i, "TENZ"]
  ];
  function brandFromTitle(t) {
    var s = String(t || "").replace(/^(\s*([\[【［]\s*木頭仁\s*[\]】］]|🔨|【|日本)\s*)+/, "");
    for (var i = 0; i < BRANDS.length; i++) if (BRANDS[i][0].test(s)) return BRANDS[i][1];
    return "";
  }
  function mpnFromTitle(t, brand) {
    var re = /(?:^|[^A-Za-z0-9-])([A-Z]{1,4}-(?=[A-Z0-9]*\d)[A-Z0-9]{2,12})(?![A-Za-z0-9-])/g, m, found = {};
    while ((m = re.exec(t))) found[m[1]] = 1;
    if (brand === "Z-Saw") { var z = /No\.\s?(\d{5})\b/.exec(t); if (z) found[z[1]] = 1; }
    var keys = Object.keys(found);
    return keys.length === 1 ? keys[0] : ""; // 0 個或多個不同型號 ⇒ 不寫
  }
  function readJsonObjectAt(src, i) { // 從 src[i]==='{' 抓出完整 JSON 物件（略過字串內的括號）
    var depth = 0, inStr = false, esc = false;
    for (var j = i; j < src.length; j++) {
      var c = src[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return JSON.parse(src.slice(i, j + 1));
    }
    return null;
  }
  function pageProductJson(handle) {
    var ss = document.scripts;
    for (var i = 0; i < ss.length; i++) {
      if (ss[i].src) continue;
      var tx = ss[i].textContent || "";
      var k = tx.indexOf("OptionSelectors('productSelect'");
      if (k < 0) continue;
      var p = tx.indexOf("product:", k);
      var b = p < 0 ? -1 : tx.indexOf("{", p);
      if (b < 0) continue;
      try {
        var o = readJsonObjectAt(tx, b);
        if (o && o.handle === handle && o.variants && o.variants.length) return o;
      } catch (e) {}
    }
    return null;
  }
  function addProductJsonLd() {
    var m = /^\/products\/([^\/?#]+)\/?$/.exec(location.pathname);
    if (!m || document.getElementById("wr-product-ld")) return;
    var md = document.querySelector('[itemscope][itemtype$="schema.org/Product"]');
    if (!md) return;
    var mdUrlEl = md.querySelector('meta[itemprop="url"]');
    var mdNameEl = md.querySelector('[itemprop="name"]');
    var mdPriceEl = md.querySelector('[itemprop="price"]');
    var mdCurEl = md.querySelector('[itemprop="priceCurrency"]');
    var mdAvailEl = md.querySelector('[itemprop="availability"]');
    var url = mdUrlEl && mdUrlEl.getAttribute("content");
    var name = mdNameEl && (mdNameEl.getAttribute("content") || mdNameEl.textContent || "").trim();
    if (!url || !name) return;
    var handle = m[1];
    try { handle = decodeURIComponent(handle); } catch (e) {}
    var prod = pageProductJson(handle);
    if (!prod) return; // 主題的 OptionSelectors 還沒輸出 ⇒ 下一輪再試

    var brand = (prod.vendor && String(prod.vendor).trim()) ||
      (prod.brands && prod.brands[0] && (prod.brands[0].name || prod.brands[0])) || brandFromTitle(prod.name || name);
    if (typeof brand !== "string") brand = "";
    var mpn = mpnFromTitle(prod.name || name, brand);
    var currency = (mdCurEl && mdCurEl.getAttribute("content")) || "TWD";
    var mdPrice = mdPriceEl ? parseFloat(mdPriceEl.getAttribute("content")) : NaN;

    var agg = null;
    var vs = prod.variants.filter(function (v) { return v && v.price > 0; });
    if (vs.length > 1) {
      var lo = Infinity, hi = -Infinity, anyAvail = false;
      vs.forEach(function (v) { lo = Math.min(lo, v.price / 100); hi = Math.max(hi, v.price / 100); if (v.available) anyAvail = true; });
      var ok = Math.abs(lo - Number(prod.price_min)) < 0.01 && Math.abs(hi - Number(prod.price_max)) < 0.01 &&
        (!isFinite(mdPrice) || Math.abs(lo - mdPrice) < 0.01);
      if (ok && hi > lo) {
        agg = { "@type": "AggregateOffer", priceCurrency: currency, lowPrice: lo, highPrice: hi, offerCount: vs.length,
          availability: anyAvail ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: url };
      }
    }
    if (!brand && !mpn && !agg) return; // 沒東西可補就不加
    var id = url.split("#")[0] + "#product";

    // 商品描述已自帶 JSON-LD Product（同網址）⇒ 只補缺的欄位
    var lds = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < lds.length; i++) {
      var data;
      try { data = JSON.parse(lds[i].textContent); } catch (e) { continue; }
      var arr = Array.isArray(data) ? data : data && data["@graph"] ? data["@graph"] : [data];
      for (var j = 0; j < arr.length; j++) {
        var n = arr[j];
        if (!n || n["@type"] !== "Product") continue;
        var nu = String(n["@id"] || n.url || "").split("#")[0];
        if (nu !== url.split("#")[0]) continue;
        if (brand && !n.brand) n.brand = { "@type": "Brand", name: brand };
        if (mpn && !n.mpn) n.mpn = mpn;
        if (agg && !n.offers) n.offers = agg;
        lds[i].textContent = JSON.stringify(data);
        lds[i].id = "wr-product-ld";
        if (n["@id"]) md.setAttribute("itemid", n["@id"]);
        return;
      }
    }

    var node = { "@context": "https://schema.org", "@type": "Product", "@id": id, url: url, name: name };
    var img = document.querySelector('meta[property="og:image"]');
    if (img && img.getAttribute("content")) node.image = img.getAttribute("content");
    if (brand) node.brand = { "@type": "Brand", name: brand };
    if (mpn) node.mpn = mpn;
    if (agg) node.offers = agg;
    else if (isFinite(mdPrice)) {
      node.offers = { "@type": "Offer", priceCurrency: currency, price: mdPrice, url: url };
      var av = mdAvailEl && (mdAvailEl.getAttribute("href") || mdAvailEl.getAttribute("content"));
      if (av) node.offers.availability = av.indexOf("schema.org") >= 0 ? av.replace(/^http:/, "https:") : "https://schema.org/" + av;
    }
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "wr-product-ld";
    s.textContent = JSON.stringify(node);
    document.head.appendChild(s);
    md.setAttribute("itemid", id);
  }

  function runProductFeatures() {
    try { addProductJsonLd(); } catch (e) {}
    try { courseFixes(); } catch (e) {}
    fixVariantPrices();
    addShipInfo();
    addTrustBadges();
    initStickyAtc();
  }

  function start() {
    injectStyle();
    initAnnouncement();
    initShipBar();
    var tries = 0;
    var iv = setInterval(function () {
      runProductFeatures();
      var done =
        document.getElementById("wr-ship-info") &&
        document.getElementById("wr-badges") &&
        document.getElementById("wr-sticky-atc");
      if (++tries > 20 || done) clearInterval(iv);
    }, 500);
    runProductFeatures();
    // 課程頁評價數是評價 App 晚點才填的 ⇒ 另外每秒重判 20 秒（上面的輪詢可能一秒內就收工）
    if (isCoursePage()) {
      var ct = 0;
      var civ = setInterval(function () { try { courseFixes(); } catch (e) {} if (++ct > 20) clearInterval(civ); }, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
