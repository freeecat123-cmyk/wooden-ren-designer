"use client";

import { useMemo, useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { buildPackPlan, downloadTemplatePack, type PackMode } from "@/lib/export/template-pack/pack";

/**
 * 1:1 實尺樣板下載——列印後貼在木料上照著描輪廓、點榫孔中心。太大的零件
 * 會自動退回既有的比例零件圖（buildPackPlan 內部處理，這裡只顯示退回件數）。
 *
 * 效能：buildPackPlan 對每個零件呼叫 pickTemplateFaces（每個加工面各一張）並產生完整樣板 SVG，
 * 但實測零件數最多的家具（chest-of-drawers 56 件、wardrobe 47 件）中位數
 * 分別 3.86ms／1.95ms（5 次量測，scripts 見 task-9-report.md），遠低於
 * 50ms 門檻，用 useMemo 在 render 期間算沒問題，不用等使用者點開才算。
 *
 * 字串沿用同卡片 ThreeDExportButton 內較新的「零件輪廓 ZIP」等按鈕的慣例
 * （寫死中文、不進 next-intl）——那幾顆按鈕是同性質的「打包下載」功能，
 * 加入時就沒有補 next-intl key，這裡跟隨既有慣例。
 *
 * 模式切換：printshop（預設，選紙＋可能斜擺，拿去輸出中心印）／
 * a4（全部在家用 A4 拼接，不旋轉，張數上限 6，超過退回零件圖）。
 */
export function TemplatePackButton({ design }: { design: FurnitureDesign }) {
  const [mode, setMode] = useState<PackMode>("printshop");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const plan = useMemo(() => buildPackPlan(design, mode), [design, mode]);
  const sheetCount = useMemo(
    () => Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0),
    [plan],
  );
  const fallbackCount = useMemo(() => plan.rows.filter((r) => !r.placement).length, [plan]);
  const papers = useMemo(() => Array.from(plan.byPaper.keys()).join("、"), [plan]);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      await downloadTemplatePack(design, (d, t) => setProgress([d, t]), mode);
    } catch (e) {
      // downloadTemplatePack 丟出的訊息已經是給使用者看的中文，直接顯示即可，不要再包一層。
      setErr(e instanceof Error ? e.message : "產生失敗，請重試。");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="px-4 py-2.5 border-t border-sky-100 bg-sky-50/40 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="text-zinc-500 font-medium">📏 1:1 實尺樣板</span>
      <div className="flex rounded-md border border-sky-300 overflow-hidden" role="radiogroup" aria-label="樣板輸出模式">
        <button
          type="button"
          onClick={() => setMode("printshop")}
          disabled={busy}
          aria-pressed={mode === "printshop"}
          className={`px-2 py-1 transition-colors disabled:cursor-not-allowed ${
            mode === "printshop" ? "bg-sky-600 text-white" : "bg-white text-sky-800 hover:bg-sky-50"
          }`}
          title="選最合適的紙張大小（可能需要斜擺），拿去輸出中心印。"
        >
          輸出中心
        </button>
        <button
          type="button"
          onClick={() => setMode("a4")}
          disabled={busy}
          aria-pressed={mode === "a4"}
          className={`px-2 py-1 border-l border-sky-300 transition-colors disabled:cursor-not-allowed ${
            mode === "a4" ? "bg-sky-600 text-white" : "bg-white text-sky-800 hover:bg-sky-50"
          }`}
          title="全部切成 A4，在家印，裁邊對齊虛線貼起來。張數上限 6 張，超過的零件會退回零件圖。"
        >
          在家用 A4 拼接
        </button>
      </div>
      <button
        type="button"
        onClick={go}
        disabled={busy || sheetCount === 0}
        className="px-2.5 py-1 border border-sky-400 rounded-md bg-white hover:border-sky-500 hover:bg-sky-50 text-sky-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={
          mode === "a4"
            ? "全部切成 A4 拼接，不旋轉。每張右／下邊裁切線裁掉，對齊下一張的虛線再貼。整包第一張是印表機測試頁，務必先印那張確認邊界安全。太大（超過 6 張）的零件會自動退回零件圖。"
            : "每個零件的每個加工面各一張 1:1 實尺樣板 PDF（依紙張大小分檔），打包 ZIP。列印後貼在木料上照著描輪廓、點榫孔中心。太大的零件會自動退回零件圖（比例縮尺，需自行放樣）。"
        }
      >
        {busy
          ? progress
            ? `產生中 ${progress[0]}/${progress[1]}`
            : "產生中…"
          : sheetCount > 0
            ? `下載實尺樣板（共 ${sheetCount} 張・${papers}）`
            : "下載實尺樣板"}
      </button>
      {fallbackCount > 0 && (
        <span className="text-zinc-500">另有 {fallbackCount} 件太大，請改印零件圖</span>
      )}
      {err && <p className="w-full text-rose-600">{err}</p>}
    </div>
  );
}
