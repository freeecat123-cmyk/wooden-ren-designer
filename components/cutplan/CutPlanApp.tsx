"use client";

import { useMemo, useState } from "react";
import type { NestConfig } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { planFromSpecs, indexToCode } from "@/lib/cutplan/piece-spec";
import { MATERIALS } from "@/lib/materials";
import { CutPlanConfigPanel } from "./CutPlanConfigPanel";
import { PiecesEditor } from "./PiecesEditor";
import { CutPlanSection } from "./CutPlanSection";
import { StockEditor } from "./StockEditor";

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

  const plan = useMemo(() => planFromSpecs(specs, config), [specs, config]);

  const totalBins = plan.groups.reduce((s, g) => s + g.bins.length, 0);
  const totalUnplaced = plan.groups.reduce((s, g) => s + g.unplaced.length, 0);
  const totalPieces = specs.reduce((s, sp) => s + sp.quantity, 0);

  const handlePrint = () => window.print();
  const handleReset = () => {
    if (confirm("重設為家具設計的原始零件清單？目前的編輯會全部丟失。")) {
      setSpecs(initialSpecs);
    }
  };

  const hasStock = config.inventory.length > 0;

  return (
    <div className="space-y-6">
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

      <header className="hidden print:block">
        <h1 className="text-2xl font-bold">{entryNameZh}．裁切排料圖</h1>
        <p className="text-sm text-zinc-600 mt-1">
          共 {totalBins} 塊原料．鋸路 {config.kerf}mm．最小餘料{" "}
          {config.minWasteMm}mm
        </p>
        <hr className="my-3" />
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
        <div className="space-y-8">
          {plan.groups.map((g, i) => (
            <div
              key={`grp-${g.kind}-${g.material ?? "_"}-${g.thickness}-${i}`}
              className="print:break-inside-avoid"
            >
              <CutPlanSection group={g} />
            </div>
          ))}
        </div>
      )}

      <section className="hidden print:block mt-6">
        <h3 className="text-sm font-semibold mb-2">零件清單</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="text-center p-1 w-8">#</th>
              <th className="text-left p-1">零件</th>
              <th className="text-left p-1">材質</th>
              <th className="text-right p-1">長 × 寬 × 厚 (mm)</th>
              <th className="text-right p-1">數量</th>
            </tr>
          </thead>
          <tbody>
            {specs.map((s, idx) => (
              <tr key={s.id} className="border-b border-zinc-100">
                <td className="p-1 text-center font-mono font-bold">{indexToCode(idx)}</td>
                <td className="p-1">{s.name}</td>
                <td className="p-1">
                  {MATERIALS[s.material]?.nameZh ?? s.material}
                  {s.billable === "plywood"
                    ? " / 夾板"
                    : s.billable === "mdf"
                    ? " / 中纖板"
                    : ""}
                </td>
                <td className="text-right p-1 font-mono">
                  {s.length} × {s.width} × {s.thickness}
                </td>
                <td className="text-right p-1">{s.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
