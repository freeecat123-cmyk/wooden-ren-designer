"use client";

import { useState } from "react";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { MATERIALS } from "@/lib/materials";
import type { BillableMaterial, MaterialId, SheetGood } from "@/lib/types";

const MATERIAL_OPTIONS = Object.values(MATERIALS).map((m) => ({
  id: m.id,
  label: m.nameZh,
}));

const SHEET_GOOD_OPTIONS: Array<{ id: SheetGood; label: string }> = [
  { id: "plywood", label: "夾板" },
  { id: "mdf", label: "中纖板" },
];

function genId() {
  return `spec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function PiecesEditor({
  specs,
  onChange,
}: {
  specs: PieceSpec[];
  onChange: (next: PieceSpec[]) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const patchSpec = (id: string, partial: Partial<PieceSpec>) => {
    onChange(specs.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  };

  const removeSpec = (id: string) => {
    onChange(specs.filter((s) => s.id !== id));
  };

  const duplicateSpec = (id: string) => {
    const src = specs.find((s) => s.id === id);
    if (!src) return;
    const copy: PieceSpec = { ...src, id: genId(), quantity: 1, name: src.name + " 副本" };
    onChange([...specs, copy]);
  };

  const addBlank = () => {
    const base = specs[0];
    const blank: PieceSpec = {
      id: genId(),
      name: "新零件",
      length: 500,
      width: 100,
      thickness: 18,
      material: base?.material ?? ("maple" as MaterialId),
      billable: (base?.material ?? "maple") as BillableMaterial,
      quantity: 1,
      allowRotate: false,
    };
    onChange([...specs, blank]);
  };

  // 把 billable 從 dropdown 值轉回 spec：實木走 material、板材走 SheetGood
  const setBillable = (id: string, val: string) => {
    if (val === "plywood" || val === "mdf") {
      patchSpec(id, { billable: val as SheetGood });
    } else {
      patchSpec(id, { billable: val as MaterialId, material: val as MaterialId });
    }
  };

  const totalCount = specs.reduce((s, sp) => s + sp.quantity, 0);

  return (
    <section className="border border-zinc-200 rounded-lg overflow-hidden">
      <header className="flex items-center justify-between p-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-zinc-700">零件清單</h2>
          <span className="text-xs text-zinc-500">
            {specs.length} 種規格．共 {totalCount} 件
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="px-2 py-1 text-xs bg-white border border-zinc-300 rounded hover:bg-zinc-50"
          >
            {collapsed ? "展開" : "收合"}
          </button>
          <button
            onClick={addBlank}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            ＋ 新增零件
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2 w-40">名稱</th>
                <th className="text-left px-3 py-2 w-36">材質</th>
                <th className="text-right px-2 py-2 w-20">長</th>
                <th className="text-right px-2 py-2 w-20">寬</th>
                <th className="text-right px-2 py-2 w-20">厚</th>
                <th className="text-right px-2 py-2 w-16">數量</th>
                <th className="text-center px-2 py-2 w-16">旋轉</th>
                <th className="px-2 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {specs.map((s) => {
                const billableVal =
                  s.billable === "plywood" || s.billable === "mdf"
                    ? s.billable
                    : s.material;
                return (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="px-3 py-1">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => patchSpec(s.id, { name: e.target.value })}
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-1">
                      <select
                        value={billableVal}
                        onChange={(e) => setBillable(s.id, e.target.value)}
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm"
                      >
                        <optgroup label="實木">
                          {MATERIAL_OPTIONS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="板材">
                          {SHEET_GOOD_OPTIONS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={s.length}
                        onChange={(e) =>
                          patchSpec(s.id, { length: Number(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={s.width}
                        onChange={(e) =>
                          patchSpec(s.id, { width: Number(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={s.thickness}
                        onChange={(e) =>
                          patchSpec(s.id, { thickness: Number(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min={1}
                        value={s.quantity}
                        onChange={(e) =>
                          patchSpec(s.id, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={s.allowRotate}
                        onChange={(e) => patchSpec(s.id, { allowRotate: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <button
                        onClick={() => duplicateSpec(s.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 mr-2"
                        title="複製一列"
                      >
                        複製
                      </button>
                      <button
                        onClick={() => removeSpec(s.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="刪除這列"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
