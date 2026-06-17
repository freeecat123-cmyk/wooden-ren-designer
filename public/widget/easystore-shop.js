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
      "@media(max-width:600px){#wr-ship-bar{width:200px;left:10px;bottom:10px}}"
    ].join("");
    document.head.appendChild(st);
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

  function start() {
    injectStyle();
    initShipBar();
    var tries = 0;
    var iv = setInterval(function () {
      addShipInfo();
      if (++tries > 20 || document.getElementById("wr-ship-info")) clearInterval(iv);
    }, 500);
    addShipInfo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
