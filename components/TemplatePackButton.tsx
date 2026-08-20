"use client";

import { useEffect, useMemo, useState } from "react";
import type { FurnitureDesign } from "@/lib/types";
import { buildPackPlan, downloadTemplatePack, type PackMode } from "@/lib/export/template-pack/pack";
import {
  CALIBRATION_TEST_LINE_MM,
  CALIBRATION_MIN_S,
  CALIBRATION_MAX_S,
  CALIBRATION_NEGLIGIBLE_MM,
} from "@/lib/export/template-pack/tiling";

/**
 * 印表機校正——存 localStorage，跨次記住（實機回饋：印表機的縮放誤差是固定的
 * 機械特性，不是列印設定問題，量一次就能一直用，不該每次重打）。
 * key 格式沿用 components/branding/branding.ts 的既有慣例
 * （`wooden-ren-designer:branding:v1`）。
 */
const CALIBRATION_STORAGE_KEY = "wooden-ren-designer:printerCalibration:v1";
const CALIBRATION_MIN_MM = CALIBRATION_TEST_LINE_MM * CALIBRATION_MIN_S;
const CALIBRATION_MAX_MM = CALIBRATION_TEST_LINE_MM * CALIBRATION_MAX_S;

/** 讀 localStorage 存的校正值。壞值（手動改過 localStorage、格式不對、超出合理範圍）
 * 一律當作沒設定過，不能讓壞值讓整包幾何爆掉。 */
function loadStoredCalibrationMm(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    const v = (data as { measuredMm?: unknown } | null)?.measuredMm;
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    if (v < CALIBRATION_MIN_MM || v > CALIBRATION_MAX_MM) return null;
    return v;
  } catch {
    return null;
  }
}

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

  // 印表機校正（選填，a4 模式才用得到）。欄位存的是使用者在印表機測試頁上量到
  // 的「250mm 校正線」實際長度，不是換算過的比例——直接填量到的數字比較不容易
  // 讓人自己算錯。空字串＝沒填＝不校正。跨次記住：見 loadStoredCalibrationMm。
  const [calibrationInput, setCalibrationInput] = useState("");
  const [calibrationLoaded, setCalibrationLoaded] = useState(false);

  // 開頁時讀一次 localStorage 帶入上次的值。放在 effect 裡（不是 useState 初始值）
  // 是因為 SSR 階段沒有 window，要等到 client mount 才讀，避免 hydration 不一致。
  useEffect(() => {
    const stored = loadStoredCalibrationMm();
    if (stored != null) setCalibrationInput(String(stored));
    setCalibrationLoaded(true);
  }, []);

  const calibrationTrimmed = calibrationInput.trim();
  const calibrationParsed = calibrationTrimmed === "" ? null : Number(calibrationTrimmed);
  const calibrationInvalid =
    calibrationTrimmed !== "" &&
    (calibrationParsed == null ||
      !Number.isFinite(calibrationParsed) ||
      calibrationParsed < CALIBRATION_MIN_MM ||
      calibrationParsed > CALIBRATION_MAX_MM);
  // 沒填或壞值一律當「不校正」（＝標稱值 250），不會讓整包幾何爆掉。
  const calibrationMeasuredMm =
    calibrationParsed != null && !calibrationInvalid ? calibrationParsed : CALIBRATION_TEST_LINE_MM;
  const calibrationNearNominal =
    calibrationParsed != null &&
    !calibrationInvalid &&
    Math.abs(calibrationParsed - CALIBRATION_TEST_LINE_MM) <= CALIBRATION_NEGLIGIBLE_MM;

  // 存回 localStorage：只在讀取完成後才開始存（避免開頁那一瞬間、狀態還是初始空
  // 字串時，把使用者上次存好的值蓋掉）；壞值不存，清空欄位＝移除已存的值。
  useEffect(() => {
    if (!calibrationLoaded || typeof window === "undefined") return;
    if (calibrationTrimmed === "") {
      window.localStorage.removeItem(CALIBRATION_STORAGE_KEY);
      return;
    }
    if (calibrationInvalid || calibrationParsed == null) return;
    window.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({ measuredMm: calibrationParsed }),
    );
  }, [calibrationTrimmed, calibrationInvalid, calibrationParsed, calibrationLoaded]);

  const plan = useMemo(
    () => buildPackPlan(design, mode, calibrationMeasuredMm),
    [design, mode, calibrationMeasuredMm],
  );
  const sheetCount = useMemo(
    () => Array.from(plan.byPaper.values()).reduce((s, a) => s + a.length, 0),
    [plan],
  );
  const fallbackCount = useMemo(() => plan.rows.filter((r) => !r.placement).length, [plan]);
  const papers = useMemo(() => Array.from(plan.byPaper.keys()).join("、"), [plan]);

  async function go() {
    if (mode === "a4" && calibrationInvalid) return; // 防呆：壞值擋下不下載
    setBusy(true);
    setErr(null);
    try {
      await downloadTemplatePack(design, (d, t) => setProgress([d, t]), mode, calibrationMeasuredMm);
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
        disabled={busy || sheetCount === 0 || (mode === "a4" && calibrationInvalid)}
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
      {mode === "a4" && (
        <details className="w-full text-[11px] text-zinc-600">
          <summary className="cursor-pointer select-none text-sky-700 hover:text-sky-800">
            印表機校正（選填）
          </summary>
          <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-sky-200 bg-white p-2.5">
            <p className="text-zinc-500">印表機準的話不用填。先印測試頁量一次就知道。</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <label htmlFor="tpl-pack-calibration">量到的長度</label>
              <input
                id="tpl-pack-calibration"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder={String(CALIBRATION_TEST_LINE_MM)}
                value={calibrationInput}
                onChange={(e) => setCalibrationInput(e.target.value)}
                className={`w-20 rounded border px-1.5 py-0.5 ${
                  calibrationInvalid ? "border-rose-400" : "border-zinc-300"
                }`}
              />
              <span>mm</span>
              {calibrationInput !== "" && (
                <button
                  type="button"
                  onClick={() => setCalibrationInput("")}
                  className="text-sky-700 underline hover:text-sky-800"
                >
                  清空（不校正）
                </button>
              )}
            </div>
            {calibrationInvalid && (
              <p className="text-rose-600">
                請填 {CALIBRATION_MIN_MM}～{CALIBRATION_MAX_MM} 之間的數字，落差太大可能是量錯了。
              </p>
            )}
            {!calibrationInvalid && calibrationNearNominal && (
              <p className="text-emerald-600">在誤差範圍內，你的印表機已經很準，不填也沒關係。</p>
            )}
            <p className="text-zinc-500">
              這台印表機量過一次就好，系統會記住，下次不用再填；換印表機再重新量一次。
              <br />
              填了之後，列印設定<strong className="text-zinc-700">還是維持「實際大小 / 100%」</strong>
              ——校正已經做在檔案裡了，列印對話框不要再縮放一次，不然會校正兩次。
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
