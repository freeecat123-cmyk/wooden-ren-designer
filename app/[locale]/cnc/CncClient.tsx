"use client";

/**
 * CNC 工具本體外殼：全螢幕 iframe 載入 gated 的 /api/cnc-tool。
 *
 * 工具是 framework-free 的單檔 HTML（自帶 React 19 bundle + IndexedDB 字型庫），
 * 用 iframe 隔離最乾淨——不跟站台的 React 樹打架，且 /api/cnc-tool 會再驗一次權限。
 */
export function CncClient() {
  return (
    <iframe
      src="/api/cnc-tool"
      title="CNC 刀路產生器"
      className="fixed inset-0 h-full w-full border-0"
      allow="clipboard-read; clipboard-write; fullscreen"
    />
  );
}
