"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Printer, RotateCcw, X } from "lucide-react";
import type { PrintSavedState } from "@/lib/design/print-preflight";

export interface PrintPreflight {
  name: string;
  size: string;
  savedState: PrintSavedState;
  warnings: string[];
  hasTemplates: boolean;
}

interface Props {
  /** 若提供，列印前會把 document.title 暫改成這個，讓「存成 PDF」預填有意義的檔名 */
  suggestedFilename?: string;
  preflight?: PrintPreflight;
}

async function waitForAssets() {
  const deadline = Date.now() + 15000;
  while (true) {
    const images = Array.from(document.images);
    // Off-screen pages must load too before the browser captures them for print.
    images.forEach(img => { if (img.loading === "lazy") img.loading = "eager"; });
    if (images.some(img => img.complete && !img.naturalWidth) || Array.from(document.fonts).some(font => font.status === "error")) throw Error("Print asset failed");
    if (images.every(img => img.complete && img.naturalWidth > 0) && document.fonts.status === "loaded") return;
    if (Date.now() > deadline) throw Error("Print assets timed out");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export function PrintButton({ suggestedFilename, preflight }: Props) {
  const locale = useLocale();
  const en = locale === "en";
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const restoreTitle = useRef<(() => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState(false);
  async function check() {
    setState("loading");
    try { await waitForAssets(); if (mounted.current) setState("ready"); return true; }
    catch { if (mounted.current) setState("error"); return false; }
  }
  useEffect(() => {
    mounted.current = true;
    void check();
    return () => { mounted.current = false; restoreTitle.current?.(); };
  }, []);
  async function print() {
    if (!(await check()) || !mounted.current) return;
    dialog.current?.close();
    const prev = document.title;
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); restoreTitle.current = null; };
    restoreTitle.current?.();
    restoreTitle.current = restore;
    window.addEventListener("afterprint", restore, { once: true });
    if (suggestedFilename) document.title = suggestedFilename;
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } catch { restore(); setState("error"); }
  }
  const savedCopy = {
    unsaved: en ? "No cloud design is linked to this output." : "此輸出尚未連結雲端儲存設計。",
    matching: en ? "Output parameters match the saved cloud design." : "本次輸出參數與雲端儲存內容一致。",
    changed: en ? "This output differs from the saved cloud design." : "目前輸出與雲端儲存內容不同。",
    unverified: en ? "Cloud save status could not be verified." : "目前無法確認雲端儲存狀態。",
  };
  const error = state === "error" && <div role="status" className="text-sm text-red-700">
    <p>{en ? "Images or fonts are not ready. Please retry." : "圖片或字型尚未就緒，請重試。"}</p>
    <button type="button" className="inline-flex min-h-11 items-center gap-2 underline" onClick={() => void check()}><RotateCcw size={16} />{en ? "Check again" : "重新檢查"}</button>
  </div>;

  return (
    <div className="no-print">
    <button
      type="button"
      disabled={state !== "ready"}
      onClick={() => { if (preflight) { setOpen(true); dialog.current?.showModal(); } else void print(); }}
      className="inline-flex min-h-11 items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700 disabled:opacity-50"
    >
      <Printer size={16} />{state === "loading" ? (en ? "Preparing print" : "準備列印中") : (en ? "Print / Save as PDF" : "列印 / 存成 PDF")}
    </button>
    {!open && error}
    {preflight && <dialog ref={dialog} aria-label={en ? "Confirm print" : "列印前確認"} onClose={() => setOpen(false)} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-lg border border-zinc-300 bg-white p-5 text-zinc-900 backdrop:bg-black/40">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{en ? "Confirm print" : "列印前確認"}</h2><button type="button" aria-label={en ? "Close" : "關閉"} className="min-h-11 min-w-11" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <p className="break-words font-semibold">{preflight.name}</p>
      <p className="mt-1 text-sm">{preflight.size}</p>
      <p className="mt-3 text-sm">{savedCopy[preflight.savedState]}</p>
      <div className="my-4 border-y border-zinc-200 py-3 text-sm space-y-2">
        <p>{en ? "Shop drawings: follow labeled dimensions, not measurements from the paper." : "一般施工圖：依標註尺寸製作，不可直接量紙上圖形。"}</p>
        <p>{preflight.hasTemplates
          ? (en ? "Includes 1:1 templates. Print at 100%, disable fit-to-page, and measure the printed scale before use." : "含 1:1 實尺樣板：列印比例設為 100%，關閉符合頁面；使用前仍須核對紙上實際尺寸。")
          : (en ? "This output contains no 1:1 templates." : "本次輸出不含 1:1 實尺樣板。")}</p>
      </div>
      {preflight.warnings.length > 0 && <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-amber-800">{preflight.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
      <p className="mb-4 text-xs text-zinc-500">{en ? "Export availability does not certify structural safety." : "可輸出不代表結構已通過安全驗證。"}</p>
      {open && error}
      <button type="button" disabled={state !== "ready"} className="inline-flex min-h-11 items-center gap-2 rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50" onClick={() => void print()}><Printer size={16} />{en ? "Confirm print" : "確認列印"}</button>
    </dialog>}
    </div>
  );
}
