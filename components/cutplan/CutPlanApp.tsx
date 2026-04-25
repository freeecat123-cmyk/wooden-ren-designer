"use client";

import { useEffect, useMemo, useState } from "react";
import type { NestConfig, StockItem } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { planFromSpecs } from "@/lib/cutplan/piece-spec";
import { CutPlanConfigPanel } from "./CutPlanConfigPanel";
import { PiecesEditor } from "./PiecesEditor";
import { CutPlanSection } from "./CutPlanSection";
import { StockEditor } from "./StockEditor";

const STOCK_STORAGE_KEY = "wooden-ren-designer:cutplan:stock:v1";

export function CutPlanApp({
  initialSpecs,
  initialConfig,
  entryNameZh,
}: {
  initialSpecs: PieceSpec[];
  initialConfig: NestConfig;
  entryNameZh: string;
}) {
  const [specs, setSpecs] = useState<PieceSpec[]>(initialSpecs);
  const [config, setConfig] = useState<NestConfig>(initialConfig);

  // 從 localStorage 還原上次輸入的庫存；client-only 避免 hydration 不一致
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STOCK_STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as StockItem[];
      if (Array.isArray(stored) && stored.length > 0) {
        setConfig((c) => ({ ...c, inventory: stored }));
      }
    } catch {
      /* ignore broken storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每次 inventory 變動都同步到 localStorage（含「清空」→ 刪除 key）
  useEffect(() => {
    try {
      if (config.inventory.length === 0) {
        localStorage.removeItem(STOCK_STORAGE_KEY);
      } else {
        localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(config.inventory));
      }
    } catch {
      /* ignore */
    }
  }, [config.inventory]);

  const plan = useMemo(() => planFromSpecs(specs, config), [specs, config]);

  const totalBins = plan.groups.reduce((s, g) => s + g.bins.length, 0);
  const totalUnplaced = plan.groups.reduce((s, g) => s + g.unplaced.length, 0);
  const totalPieces = specs.reduce((s, sp) => s + sp.quantity, 0);

  const handlePrint = () => {
    const original = typeof document !== "undefined" ? document.title : "";
    const date = new Date().toISOString().slice(0, 10);
    if (typeof document !== "undefined") {
      document.title = `${entryNameZh}_裁切排料圖_${date}`;
    }
    window.print();
    // 延遲還原，讓列印對話框抓到新 title 再還原
    setTimeout(() => {
      if (typeof document !== "undefined") document.title = original;
    }, 500);
  };
  const handleReset = () => {
    if (confirm("重設為家具設計的原始零件清單？目前的編輯會全部丟失。")) {
      setSpecs(initialSpecs);
    }
  };

  const hasStock = config.inventory.length > 0;

  const stockEmpty = !hasStock;
  const nothingToPlan =
    hasStock &&
    plan.groups.every((g) => g.bins.length === 0 && g.unplaced.length === 0);

  return (
    <div className="space-y-4 print:space-y-2">
      {/* 頂部狀態列 + 動作按鈕（no-print） */}
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div className="text-sm text-zinc-600">
          {entryNameZh}．共 {totalPieces} 件
          {hasStock ? `．排出 ${totalBins} 塊原料` : "．尚未列庫存"}
          {totalUnplaced > 0 && (
            <span className="ml-2 text-red-700">（{totalUnplaced} 件排不下）</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded"
          >
            ↺ 重設為原始設計
          </button>
          <button
            onClick={handlePrint}
            disabled={!hasStock}
            className="px-3 py-1.5 text-sm bg-zinc-900 hover:bg-zinc-700 text-white rounded disabled:bg-zinc-400 disabled:cursor-not-allowed"
          >
            🖨️ 列印 / PDF
          </button>
        </div>
      </div>

      {/* 主視覺：左 sticky 庫存 ↔ 右即時排料圖 */}
      <div className="grid lg:grid-cols-[5fr_7fr] gap-4 no-print">
        <aside className="lg:sticky lg:top-4 self-start">
          <StockEditor
            specs={specs}
            inventory={config.inventory}
            onChange={(inv) => setConfig({ ...config, inventory: inv })}
          />
        </aside>

        <div>
          {stockEmpty ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 min-h-[420px] flex flex-col items-center justify-center text-center">
              <p className="text-3xl mb-2">🪵</p>
              <p className="font-semibold mb-1">還沒列原料庫存</p>
              <p className="text-xs max-w-xs">
                在左邊「原料庫存」按「＋ 加一筆」加入你實際有的板才（實木 / 夾板 /
                中纖板皆可），右邊會立刻算出排料圖。
              </p>
            </div>
          ) : nothingToPlan ? (
            <div className="p-6 bg-amber-50 text-amber-800 rounded-lg">
              沒有可排料的零件——請新增零件或重設回設計。
            </div>
          ) : (
            <div className="space-y-3">
              {/* 排料策略：直接放在排料圖上方，切換立刻重算 */}
              <div className="flex items-center gap-2 px-1 flex-wrap">
                <span className="text-xs text-zinc-600">排料策略：</span>
                {(
                  [
                    { value: "guillotine", label: "刀線式", help: "最省料（小件填大件肚子）" },
                    { value: "ffd", label: "FFD", help: "第一適合，穩定" },
                    { value: "bfd", label: "BFD", help: "最佳適合，省料" },
                  ] as const
                ).map((opt) => {
                  const active = (config.strategy ?? "guillotine") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setConfig({ ...config, strategy: opt.value })}
                      title={opt.help}
                      className={`px-2.5 py-1 rounded text-xs border transition ${
                        active
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <span className="text-[11px] text-zinc-400 ml-auto">
                  鋸路 {config.kerf}mm · 餘料下限 {config.minWasteMm}mm
                </span>
              </div>

              {plan.groups.map((g, i) => (
                <div key={`grp-${g.kind}-${g.material ?? "_"}-${i}`}>
                  <CutPlanSection group={g} inventory={config.inventory} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 下半：零件清單 + 排料設定（按需展開） */}
      <details className="mt-4 rounded-lg border border-zinc-200 bg-white overflow-hidden no-print">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800">
            📋 零件清單
            <span className="ml-2 text-[11px] font-normal text-zinc-400">
              {specs.length} 種規格 · 共 {totalPieces} 件 · 從設計匯入，可手改
            </span>
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <PiecesEditor specs={specs} onChange={setSpecs} />
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden no-print">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800">
            ⚙️ 進階設定（鋸路 / 最小餘料 / 板材旋轉）
            <span className="ml-2 text-[11px] font-normal text-zinc-400">
              鋸路 {config.kerf}mm · 最小餘料 {config.minWasteMm}mm
            </span>
          </span>
          <span className="text-xs text-zinc-400">展開 / 收合</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <CutPlanConfigPanel value={config} onChange={setConfig} />
        </div>
      </details>

      {/* 列印用 header */}
      <header className="hidden print:block print:mb-2">
        <h1 className="text-lg font-bold">{entryNameZh}．裁切排料圖</h1>
        <p className="text-xs text-zinc-600">
          共 {totalBins} 塊原料．鋸路 {config.kerf}mm．最小餘料{" "}
          {config.minWasteMm}mm
        </p>
        <hr className="my-1" />
      </header>

      {/* 列印用排料圖（僅列印時顯示，螢幕版已經在上面的 grid 裡了） */}
      {hasStock && !nothingToPlan && (
        <div className="hidden print:block print:space-y-3">
          {plan.groups.map((g, i) => (
            <div key={`print-grp-${g.kind}-${g.material ?? "_"}-${i}`}>
              <CutPlanSection group={g} inventory={config.inventory} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
