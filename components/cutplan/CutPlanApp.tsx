"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { NestConfig, StockItem } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { planFromSpecs, splitSpecPrompt } from "@/lib/cutplan/piece-spec";
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
  const t = useTranslations("cutPlanApp");
  const tCsv = useTranslations("cutPlanApp.csv");
  const locale = useLocale();
  const isEn = locale === "en";
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

  // 庫存嚴格跟設計材料同步：
  // - 設計用到的材料：保留現有 entry（保留使用者自訂尺寸）或補預設
  // - 設計沒用到的舊材料：過濾掉，不混淆
  //
  // 之前只「加缺的」不「移多餘的」，使用者切換木種後 localStorage 累積一堆
  // 不相關 entry（木芯板設計卻看到楓木+夾板+中纖板）。
  useEffect(() => {
    setConfig((c) => {
      const isSheetPrimary = (mat?: string) =>
        mat === "blockboard-primary" ||
        mat === "plywood-primary" ||
        mat === "mdf-primary";
      const keyOf = (
        kind: StockItem["kind"],
        material?: string,
      ) => (kind === "solid" ? `solid|${material}` : kind);

      // 1. 收集設計用到的 (kind, material) keys + 對應 spec
      const usedKeys = new Set<string>();
      const usedSpecsByKey = new Map<string, (typeof initialSpecs)[number]>();
      for (const sp of initialSpecs) {
        const kind: StockItem["kind"] =
          sp.billable === "plywood" || sp.billable === "mdf"
            ? sp.billable
            : "solid";
        const key = keyOf(kind, sp.material);
        if (!usedKeys.has(key)) {
          usedKeys.add(key);
          usedSpecsByKey.set(key, sp);
        }
      }

      // 2. 過濾現有 inventory 只留 design 用到的 material（保留使用者自訂尺寸）
      const kept = c.inventory.filter((s) =>
        usedKeys.has(keyOf(s.kind, s.material)),
      );
      const presentKeys = new Set(kept.map((s) => keyOf(s.kind, s.material)));

      // 3. 缺的材料補預設 entry
      const additions: StockItem[] = [];
      for (const [key, sp] of usedSpecsByKey) {
        if (presentKeys.has(key)) continue;
        const kind: StockItem["kind"] =
          sp.billable === "plywood" || sp.billable === "mdf"
            ? sp.billable
            : "solid";
        if (kind === "solid") {
          if (isSheetPrimary(sp.material)) {
            additions.push({
              kind: "solid",
              material: sp.material,
              thickness: 0,
              length: 2400,
              width: 1220,
              count: null,
            });
          } else {
            additions.push({
              kind: "solid",
              material: sp.material,
              thickness: 0,
              length: 3000,
              width: 200,
              count: null,
            });
          }
        } else {
          additions.push({
            kind,
            thickness: 18,
            length: 2400,
            width: 1200,
            count: null,
          });
        }
      }

      if (kept.length === c.inventory.length && additions.length === 0) {
        return c;
      }
      return { ...c, inventory: [...kept, ...additions] };
    });
  }, [initialSpecs]);

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

  const handleExportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    const csvEscape = (v: string | number) => {
      const s = String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows: string[] = [];
    rows.push(tCsv("h1"));
    rows.push(
      [
        tCsv("col1Name"),
        tCsv("col1Length"),
        tCsv("col1Width"),
        tCsv("col1Thickness"),
        tCsv("col1Material"),
        tCsv("col1Billable"),
        tCsv("col1Quantity"),
      ]
        .map(csvEscape)
        .join(","),
    );
    for (const sp of specs) {
      rows.push(
        [
          sp.name,
          sp.length,
          sp.width,
          sp.thickness,
          sp.material,
          sp.billable,
          sp.quantity,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    rows.push("");
    rows.push(tCsv("h2"));
    rows.push(
      [
        tCsv("col2Kind"),
        tCsv("col2Material"),
        tCsv("col2Thickness"),
        tCsv("col2BinIdx"),
        tCsv("col2StockLength"),
        tCsv("col2StockWidth"),
        tCsv("col2Code"),
        tCsv("col2Part"),
        tCsv("col2CutLength"),
        tCsv("col2CutWidth"),
        tCsv("col2X"),
        tCsv("col2Y"),
        tCsv("col2Rotated"),
      ]
        .map(csvEscape)
        .join(","),
    );
    for (const g of plan.groups) {
      g.bins.forEach((bin, binIdx) => {
        for (const shelf of bin.shelves) {
          for (const p of shelf.pieces) {
            rows.push(
              [
                g.kind,
                g.material ?? "",
                g.thickness,
                binIdx + 1,
                bin.stockLength,
                bin.stockWidth,
                p.piece.code ?? "",
                isEn ? p.piece.partNameEn : p.piece.partNameZh,
                p.piece.length,
                p.piece.width,
                p.x,
                p.y,
                p.rotated ? tCsv("yes") : tCsv("no"),
              ]
                .map(csvEscape)
                .join(","),
            );
          }
        }
      });
      if (g.unplaced.length > 0) {
        for (const piece of g.unplaced) {
          rows.push(
            [
              g.kind,
              g.material ?? "",
              g.thickness,
              tCsv("unplaced"),
              "",
              "",
              piece.code ?? "",
              isEn ? piece.partNameEn : piece.partNameZh,
              piece.length,
              piece.width,
              "",
              "",
              "",
            ]
              .map(csvEscape)
              .join(","),
          );
        }
      }
    }
    // BOM (Excel 中文相容)
    const blob = new Blob(["﻿" + rows.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("csvFilenameTpl", { name: entryNameZh, date });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const original = typeof document !== "undefined" ? document.title : "";
    const date = new Date().toISOString().slice(0, 10);
    if (typeof document !== "undefined") {
      document.title = t("printDocTitleTpl", { name: entryNameZh, date });
    }
    window.print();
    // 延遲還原，讓列印對話框抓到新 title 再還原
    setTimeout(() => {
      if (typeof document !== "undefined") document.title = original;
    }, 500);
  };
  const handleReset = () => {
    if (confirm(t("confirmReset"))) {
      setSpecs(initialSpecs);
    }
  };
  // 共用分割 callback：PiecesEditor 的 ✂ 按鈕 + CutPlanSection 排不下警告區的 ✂ 都用
  const handleSplitSpec = (id: string) => splitSpecPrompt(specs, id, setSpecs);

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
          {t("summaryPiecesTpl", { name: entryNameZh, n: totalPieces })}
          {hasStock ? t("summaryStockTpl", { n: totalBins }) : t("summaryNoStock")}
          {totalUnplaced > 0 && (
            <span className="ml-2 text-red-700">
              {t("summaryUnplacedTpl", { n: totalUnplaced })}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded"
          >
            {t("resetBtn")}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={specs.length === 0}
            title={t("csvBtnTitle")}
            className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:bg-zinc-400 disabled:cursor-not-allowed"
          >
            {t("csvBtn")}
          </button>
          <button
            onClick={handlePrint}
            disabled={!hasStock}
            className="px-3 py-1.5 text-sm bg-zinc-900 hover:bg-zinc-700 text-white rounded disabled:bg-zinc-400 disabled:cursor-not-allowed"
          >
            {t("printBtn")}
          </button>
        </div>
      </div>

      {totalUnplaced > 0 && (
        <div className="no-print rounded-lg border-2 border-red-300 bg-red-50 p-3">
          <div className="text-sm font-semibold text-red-900 mb-1.5 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>{t("unplacedH", { n: totalUnplaced })}</span>
          </div>
          <p className="text-[11px] text-red-700 mb-2 leading-relaxed">
            {t("unplacedBody")}
          </p>
          <ul className="text-xs text-red-900 space-y-0.5">
            {plan.groups.flatMap((g, gi) =>
              g.unplaced.map((p, pi) => {
                const kindLabel =
                  g.kind === "solid"
                    ? t("kindSolid")
                    : g.kind === "plywood"
                      ? t("kindPlywood")
                      : t("kindMdf");
                return (
                  <li key={`unp-${gi}-${pi}-${p.partId}`} className="font-mono">
                    · {isEn ? p.partNameEn : p.partNameZh}　{p.length} × {p.width} × {p.thickness} mm
                    <span className="text-red-600 ml-1">
                      {t("kindParenTpl", { label: kindLabel })}
                    </span>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      )}

      {/* 主視覺：庫存全寬置頂 ↔ 排料圖下方雙欄 */}
      <div className="space-y-4 no-print">
        <StockEditor
          specs={specs}
          inventory={config.inventory}
          onChange={(inv) => setConfig({ ...config, inventory: inv })}
        />

        <div>
          {stockEmpty ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 min-h-[420px] flex flex-col items-center justify-center text-center">
              <p className="text-3xl mb-2">🪵</p>
              <p className="font-semibold mb-1">{t("stockEmptyH")}</p>
              <p className="text-xs max-w-xs">{t("stockEmptyBody")}</p>
            </div>
          ) : nothingToPlan ? (
            <div className="p-6 bg-amber-50 text-amber-800 rounded-lg">
              {t("nothingToPlan")}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1 flex-wrap">
                <span className="text-xs text-zinc-600">{t("strategyLbl")}</span>
                {(
                  [
                    { value: "guillotine", label: t("strategyGuillotineLabel"), help: t("strategyGuillotineHelp") },
                    { value: "ffd", label: t("strategyFfdLabel"), help: t("strategyFfdHelp") },
                    { value: "bfd", label: t("strategyBfdLabel"), help: t("strategyBfdHelp") },
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
                  {t("strategyKerfTpl", { kerf: config.kerf, min: config.minWasteMm })}
                </span>
              </div>

              {plan.groups.map((g, i) => (
                <div key={`grp-${g.kind}-${g.material ?? "_"}-${i}`}>
                  <CutPlanSection
                    group={g}
                    inventory={config.inventory}
                    onSplitSpec={handleSplitSpec}
                  />
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
            {t("piecesDetailsH")}
            <span className="ml-2 text-[11px] font-normal text-zinc-400">
              {t("piecesDetailsCountTpl", { specs: specs.length, pieces: totalPieces })}
            </span>
          </span>
          <span className="text-xs text-zinc-400">{t("expandCollapse")}</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <PiecesEditor specs={specs} onChange={setSpecs} />
        </div>
      </details>

      <details className="mt-3 rounded-lg border border-zinc-200 bg-white overflow-hidden no-print">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm flex items-center justify-between hover:bg-zinc-50">
          <span className="font-medium text-zinc-800">
            {t("advancedDetailsH")}
            <span className="ml-2 text-[11px] font-normal text-zinc-400">
              {t("advancedDetailsCountTpl", { kerf: config.kerf, min: config.minWasteMm })}
            </span>
          </span>
          <span className="text-xs text-zinc-400">{t("expandCollapse")}</span>
        </summary>
        <div className="border-t border-zinc-200 p-4">
          <CutPlanConfigPanel value={config} onChange={setConfig} />
        </div>
      </details>

      <header className="hidden print:block print:mb-2">
        <h1 className="text-lg font-bold">{t("printHeaderTpl", { name: entryNameZh })}</h1>
        <p className="text-xs text-zinc-600">
          {t("printSubTpl", { n: totalBins, kerf: config.kerf, min: config.minWasteMm })}
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
