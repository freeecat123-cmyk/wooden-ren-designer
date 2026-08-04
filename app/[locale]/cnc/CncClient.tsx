"use client";

import { useEffect } from "react";

/**
 * CNC 工具本體外殼：全螢幕 iframe 載入 gated 的 /api/cnc-tool。
 *
 * 工具是 framework-free 的單檔 HTML（自帶 React 19 bundle + IndexedDB 字型庫），
 * 用 iframe 隔離最乾淨——不跟站台的 React 樹打架，且 /api/cnc-tool 會再驗一次權限。
 *
 * ⚠️ 這一頁必須「整個蓋掉站台外框」：
 *  /cnc 是雙頭路由（沒權限看銷售頁、有權限進工具），而站台 layout 的 SiteHeader/SiteFooter
 *  是無條件渲染的（SiteHeader 只對 /design//print//quote 隱藏，SiteFooter 完全沒有隱藏邏輯）。
 *  銷售頁需要那層外框，工具頁不需要——而且 iframe 原本是 `fixed inset-0` **沒有 z-index**，
 *  SiteHeader 是 `sticky z-40`，所以站台導覽列會直接壓在工具上面（user 實機截圖回報）。
 *  解法兩層並用，任一層失效都還撐得住：
 *   ① iframe 提到 z-[100]，穩穩蓋過 z-40 的 header。
 *   ② 掛載時在 <html> 打一個旗標，用 CSS 把站台 header/footer 收起來並鎖住捲動——
 *      不然使用者仍可能捲到工具底下的頁尾，或讓螢幕閱讀器讀到被遮住的導覽。
 *  卸載時一定要還原，否則切回別的頁面會沒有導覽列。
 */
export function CncClient() {
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.fullscreenTool = "1";
    return () => { delete el.dataset.fullscreenTool; };
  }, []);

  return (
    <iframe
      src="/api/cnc-tool"
      title="CNC 刀路產生器"
      className="fixed inset-0 z-[100] h-full w-full border-0"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}
