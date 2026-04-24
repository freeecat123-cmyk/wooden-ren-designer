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

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="no-print">
        <CutPlanConfigPanel value={config} onChange={setConfig} />
      </div>

      <div className="no-print">
        <PiecesEditor specs={specs} onChange={setSpecs} />
      </div>

      <div className="no-print">
        <StockEditor
          specs={specs}
          inventory={config.inventory}
          onChange={(inv) => setConfig({ ...config, inventory: inv })}
        />
      </div>

      <div className="flex items-center justify-between gap-3 no-print">
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

      <header className="hidden print:block print:mb-2">
        <h1 className="text-lg font-bold">{entryNameZh}．裁切排料圖</h1>
        <p className="text-xs text-zinc-600">
          共 {totalBins} 塊原料．鋸路 {config.kerf}mm．最小餘料{" "}
          {config.minWasteMm}mm
        </p>
        <hr className="my-1" />
      </header>

      {!hasStock ? (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          <p className="font-semibold mb-1">🪵 還沒列原料庫存</p>
          <p>
            在上面「原料庫存」區按「＋ 加一筆」加入你實際有的板才（實木 / 夾板 /
            中纖板皆可），才會開始排料。
          </p>
        </div>
      ) : plan.groups.every((g) => g.bins.length === 0 && g.unplaced.length === 0) ? (
        <div className="p-6 bg-amber-50 text-amber-800 rounded-lg">
          沒有可排料的零件——請新增零件或重設回設計。
        </div>
      ) : (
        <div className="space-y-8 print:space-y-3">
          {plan.groups.map((g, i) => (
            <div key={`grp-${g.kind}-${g.material ?? "_"}-${i}`}>
              <CutPlanSection group={g} inventory={config.inventory} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
