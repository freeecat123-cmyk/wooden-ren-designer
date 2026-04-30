/**
 * 木頭仁 AI 木工大師 · 站外嵌入 widget
 *
 * 用法：在任何網頁 <head> 或 <body> 結尾貼一行 <script>：
 *
 *   <script src="https://wooden-ren-designer.vercel.app/widget/wood-master.js" async></script>
 *
 * 它會在右下角浮一個圓形按鈕，點擊展開 iframe（指向 /chat?embed=1）。
 *
 * Self-contained：不依賴 jQuery / 任何外部 lib。樣式全部 inline 避免衝突。
 */
(function () {
  if (window.__woodMasterWidgetLoaded) return;
  window.__woodMasterWidgetLoaded = true;

  // 推 widget 來源同網域（script src 自動推）
  var scripts = document.getElementsByTagName("script");
  var origin = "https://wooden-ren-designer.vercel.app";
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src || "";
    if (src.indexOf("/widget/wood-master.js") !== -1) {
      try {
        var url = new URL(src);
        origin = url.origin;
      } catch (e) {
        /* ignore */
      }
      break;
    }
  }

  var BUBBLE_BG = "#92400E"; // amber-800
  var BUBBLE_BG_HOVER = "#78350F"; // amber-900
  var WIDGET_WIDTH = 400;
  var WIDGET_HEIGHT = 600;

  function el(tag, style, html) {
    var e = document.createElement(tag);
    e.style.cssText = style;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // 浮動按鈕
  var bubble = el(
    "div",
    [
      "position:fixed",
      "right:24px",
      "bottom:24px",
      "width:60px",
      "height:60px",
      "border-radius:50%",
      "background:" + BUBBLE_BG,
      "color:white",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "cursor:pointer",
      "box-shadow:0 4px 16px rgba(0,0,0,0.2)",
      "z-index:2147483647",
      "transition:transform .15s, background .15s",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "user-select:none",
    ].join(";"),
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  );
  bubble.title = "木頭仁 AI 木工大師";
  bubble.onmouseover = function () {
    bubble.style.background = BUBBLE_BG_HOVER;
    bubble.style.transform = "scale(1.05)";
  };
  bubble.onmouseout = function () {
    bubble.style.background = BUBBLE_BG;
    bubble.style.transform = "scale(1)";
  };

  // 標籤（hover 顯示）
  var tooltip = el(
    "div",
    [
      "position:absolute",
      "right:74px",
      "top:50%",
      "transform:translateY(-50%)",
      "background:#1f2937",
      "color:white",
      "padding:6px 12px",
      "border-radius:6px",
      "font-size:12px",
      "white-space:nowrap",
      "opacity:0",
      "transition:opacity .15s",
      "pointer-events:none",
    ].join(";"),
    "問木工題 → 木頭仁 AI",
  );
  bubble.appendChild(tooltip);
  bubble.addEventListener("mouseover", function () {
    tooltip.style.opacity = "1";
  });
  bubble.addEventListener("mouseout", function () {
    tooltip.style.opacity = "0";
  });

  // 容器（展開後的 iframe 包裝）
  var panel = el(
    "div",
    [
      "position:fixed",
      "right:24px",
      "bottom:96px",
      "width:" + WIDGET_WIDTH + "px",
      "height:" + WIDGET_HEIGHT + "px",
      "max-width:calc(100vw - 32px)",
      "max-height:calc(100vh - 120px)",
      "background:white",
      "border-radius:16px",
      "box-shadow:0 12px 48px rgba(0,0,0,0.25)",
      "overflow:hidden",
      "z-index:2147483646",
      "display:none",
      "flex-direction:column",
      "border:1px solid #e5e7eb",
    ].join(";"),
  );

  // panel header（標題 + 關閉按鈕）
  var header = el(
    "div",
    [
      "display:flex",
      "justify-content:space-between",
      "align-items:center",
      "padding:10px 14px",
      "background:" + BUBBLE_BG,
      "color:white",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "font-size:14px",
      "font-weight:600",
    ].join(";"),
    '<span>🪵 木頭仁 AI 木工大師</span>',
  );
  var closeBtn = el(
    "div",
    [
      "cursor:pointer",
      "width:24px",
      "height:24px",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "border-radius:4px",
      "transition:background .15s",
      "font-size:18px",
      "line-height:1",
    ].join(";"),
    "✕",
  );
  closeBtn.onmouseover = function () {
    closeBtn.style.background = "rgba(255,255,255,0.15)";
  };
  closeBtn.onmouseout = function () {
    closeBtn.style.background = "transparent";
  };
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // iframe
  var iframe = el(
    "iframe",
    ["flex:1", "border:none", "width:100%", "height:100%"].join(";"),
  );
  iframe.title = "木頭仁 AI 木工大師";
  panel.appendChild(iframe);

  var opened = false;
  function toggle() {
    opened = !opened;
    if (opened) {
      // 第一次打開才載 iframe，省流量
      if (!iframe.src) {
        iframe.src = origin + "/chat?embed=1";
      }
      panel.style.display = "flex";
      bubble.innerHTML = "✕";
      bubble.style.fontSize = "26px";
      bubble.style.fontWeight = "300";
    } else {
      panel.style.display = "none";
      bubble.innerHTML =
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      bubble.appendChild(tooltip);
    }
  }
  bubble.onclick = toggle;
  closeBtn.onclick = function (e) {
    e.stopPropagation();
    toggle();
  };

  // mount
  document.body.appendChild(bubble);
  document.body.appendChild(panel);
})();
