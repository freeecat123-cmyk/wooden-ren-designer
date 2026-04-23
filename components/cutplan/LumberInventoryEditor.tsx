"use client";

import { useMemo } from "react";
import type { LumberStock } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { MATERIALS } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

/** 取得所有 specs 裡用到的 (material, thickness) 組合（排除板材） */
function useMTGroups(specs: PieceSpec[]) {
  return useMemo(() => {
    const map = new Map<string, { material: MaterialId; thickness: number; maxPieceW: number }>();
    for (const s of specs) {
      if (s.billable === "plywood" || s.billable === "mdf") continue;
      const k = `${s.material}|${s.thickness}`;
      const existing = map.get(k);
      const maxPieceW = Math.max(s.width, s.length);
      if (!existing || maxPieceW > existing.maxPieceW) {
        map.set(k, { material: s.material, thickness: s.thickness, maxPieceW });
      }
    }
    return Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }));
  }, [specs]);
}

export function LumberInventoryEditor({
  specs,
  inventory,
  onChange,
}: {
  specs: PieceSpec[];
  inventory: LumberStock[];
  onChange: (next: LumberStock[]) => void;
}) {
  const mtGroups = useMTGroups(specs);

  const addStock = (material: MaterialId, thickness: number) => {
    onChange([
      ...inventory,
      { material, thickness, length: 1818, width: 200, count: 1 },
    ]);
  };

  const patchStock = (idx: number, partial: Partial<LumberStock>) => {
    onChange(inventory.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  };

  const removeStock = (idx: number) => {
    onChange(inventory.filter((_, i) => i !== idx));
  };

  return (
    <section className="border border-zinc-200 rounded-lg overflow-hidden">
      <header className="p-3 bg-zinc-50 border-b border-zinc-200">
        <h2 className="text-sm font-semibold text-zinc-700">
          實木庫存（多寬度 · 2D 排料）
        </h2>
        <p className="text-[11px] text-zinc-500 mt-1">
          同材質 × 同厚度列一筆 = 開啟 2D 排料；空著就用預設的 4/6/8 尺單寬模式。
          超寬部分算 rip 切下來的邊料。
        </p>
      </header>

      <div className="p-3 space-y-4">
        {mtGroups.length === 0 && (
          <p className="text-xs text-zinc-500">（零件清單內沒有實木件）</p>
        )}
        {mtGroups.map((mt) => {
          const rows = inventory
            .map((s, idx) => ({ stock: s, idx }))
            .filter(
              (r) =>
                r.stock.material === mt.material &&
                r.stock.thickness === mt.thickness,
            );
          const hasRows = rows.length > 0;
          return (
            <div key={mt.key} className="border border-zinc-200 rounded">
              <div className="px-3 py-2 bg-zinc-50 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {MATERIALS[mt.material]?.nameZh ?? mt.material} × {mt.thickness} mm
                  <span className="ml-2 text-xs text-zinc-500">
                    {hasRows ? "2D 模式" : "（沒列 → 走單寬模式）"}
                  </span>
                </span>
                <button
                  onClick={() => addStock(mt.material, mt.thickness)}
                  className="px-2 py-0.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  ＋ 加一筆板才
                </button>
              </div>
              {hasRows && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-zinc-500">
                      <tr>
                        <th className="text-right px-2 py-1 w-24">長 (mm)</th>
                        <th className="text-right px-2 py-1 w-24">寬 (mm)</th>
                        <th className="text-right px-2 py-1 w-20">支數</th>
                        <th className="px-2 py-1 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.idx} className="border-t border-zinc-100">
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              value={r.stock.length}
                              onChange={(e) =>
                                patchStock(r.idx, {
                                  length: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              value={r.stock.width}
                              onChange={(e) =>
                                patchStock(r.idx, {
                                  width: Number(e.target.value) || 0,
                                })
                              }
                              className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number"
                              min={0}
                              placeholder="不限"
                              value={r.stock.count ?? ""}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                patchStock(r.idx, {
                                  count:
                                    e.target.value === "" || !Number.isFinite(n) || n <= 0
                                      ? null
                                      : n,
                                });
                              }}
                              className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              onClick={() => removeStock(r.idx)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
