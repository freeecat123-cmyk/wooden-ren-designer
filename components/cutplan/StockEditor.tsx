"use client";

import type { StockItem } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { MATERIALS } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

export function StockEditor({
  specs,
  inventory,
  onChange,
}: {
  specs: PieceSpec[];
  inventory: StockItem[];
  onChange: (next: StockItem[]) => void;
}) {
  // 偵測零件用到但庫存沒列的 (kind, material?) 組合——給快速加按鈕
  // 不再依厚度匹配：庫存不綁厚度，一筆 maple 1818×200 可同時供應 25/38mm 零件
  const usedKeys = new Set<string>();
  const usedMeta = new Map<
    string,
    { kind: StockItem["kind"]; material?: MaterialId }
  >();
  for (const s of specs) {
    const kind: StockItem["kind"] =
      s.billable === "plywood" || s.billable === "mdf" ? s.billable : "solid";
    const key = kind === "solid" ? `solid|${s.material}` : kind;
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      usedMeta.set(key, {
        kind,
        material: kind === "solid" ? s.material : undefined,
      });
    }
  }
  const coveredKeys = new Set<string>();
  for (const s of inventory) {
    const key = s.kind === "solid" ? `solid|${s.material}` : s.kind;
    coveredKeys.add(key);
  }

  const addRow = () => {
    onChange([
      ...inventory,
      {
        kind: "solid",
        material: "maple",
        thickness: 0,
        length: 1818,
        width: 200,
        count: null,
      },
    ]);
  };

  const quickAdd = (meta: {
    kind: StockItem["kind"];
    material?: MaterialId;
  }) => {
    if (meta.kind === "solid") {
      onChange([
        ...inventory,
        {
          kind: "solid",
          material: meta.material,
          thickness: 0,
          length: 1818,
          width: 200,
          count: null,
        },
      ]);
    } else {
      onChange([
        ...inventory,
        {
          kind: meta.kind,
          thickness: 0,
          length: 2440,
          width: 1220,
          count: null,
        },
      ]);
    }
  };

  const patchRow = (idx: number, partial: Partial<StockItem>) => {
    onChange(inventory.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  };

  const removeRow = (idx: number) => {
    onChange(inventory.filter((_, i) => i !== idx));
  };

  const uncovered = Array.from(usedKeys).filter((k) => !coveredKeys.has(k));

  return (
    <section className="border border-zinc-200 rounded-lg overflow-hidden">
      <header className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700">
            原料庫存（實木 + 板材）
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">
            {inventory.length === 0 ? (
              <span className="text-amber-700 font-semibold">
                還沒列任何板才——下面不會出現排料圖。請先加入你實際有的原料。
              </span>
            ) : (
              <>
                依「類別＋材質＋長寬」記錄實際庫存，
                <span className="font-semibold">不綁厚度</span>
                ；同一筆可同時供應不同厚度的零件。
                <span className="ml-2 text-emerald-700">
                  ✓ 已自動存到本機，下次進頁面自動帶入
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {inventory.length > 0 && (
            <button
              onClick={() => {
                if (confirm("清空所有庫存？存檔也會一起清掉。")) onChange([]);
              }}
              className="px-3 py-1 text-xs bg-zinc-100 text-zinc-600 rounded hover:bg-zinc-200"
            >
              清空
            </button>
          )}
          <button
            onClick={addRow}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            ＋ 加一筆
          </button>
        </div>
      </header>

      {inventory.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2 w-28">類別</th>
                <th className="text-left px-3 py-2 w-28">材質</th>
                <th className="text-right px-2 py-2 w-28">長 (mm)</th>
                <th className="text-right px-2 py-2 w-28">寬 (mm)</th>
                <th className="text-right px-2 py-2 w-20">支數</th>
                <th className="px-2 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((s, idx) => (
                <tr key={idx} className="border-t border-zinc-100">
                  <td className="px-3 py-1">
                    <select
                      value={s.kind}
                      onChange={(e) => {
                        const kind = e.target.value as StockItem["kind"];
                        if (kind === "solid") {
                          patchRow(idx, {
                            kind: "solid",
                            material: s.material ?? "maple",
                          });
                        } else {
                          patchRow(idx, { kind, material: undefined });
                        }
                      }}
                      className="w-full px-2 py-1 border border-zinc-200 rounded text-sm"
                    >
                      <option value="solid">實木</option>
                      <option value="plywood">夾板</option>
                      <option value="mdf">中纖板</option>
                    </select>
                  </td>
                  <td className="px-3 py-1">
                    {s.kind === "solid" ? (
                      <select
                        value={s.material ?? "maple"}
                        onChange={(e) =>
                          patchRow(idx, { material: e.target.value as MaterialId })
                        }
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm"
                      >
                        {Object.values(MATERIALS).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nameZh}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-zinc-400 px-2">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={s.length}
                      onChange={(e) =>
                        patchRow(idx, { length: Number(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={s.width}
                      onChange={(e) =>
                        patchRow(idx, { width: Number(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      placeholder="不限"
                      value={s.count ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        patchRow(idx, {
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
                      onClick={() => removeRow(idx)}
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

      {uncovered.length > 0 && (
        <div className="border-t border-zinc-100 bg-amber-50/40 p-3">
          <p className="text-xs text-zinc-600 mb-2">
            以下零件用到的類別還沒列原料（沒加就會排不下）：
          </p>
          <div className="flex flex-wrap gap-2">
            {uncovered.map((k) => {
              const meta = usedMeta.get(k)!;
              const label =
                meta.kind === "solid"
                  ? MATERIALS[meta.material!]?.nameZh ?? meta.material
                  : meta.kind === "plywood"
                  ? "夾板"
                  : "中纖板";
              return (
                <button
                  key={k}
                  onClick={() => quickAdd(meta)}
                  className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
                >
                  ＋ {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

