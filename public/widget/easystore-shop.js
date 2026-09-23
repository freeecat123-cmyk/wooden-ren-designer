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
      'body.wr-sticky-on a[href*="lin.ee"]{bottom:78px!important}'
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

  function runProductFeatures() {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
