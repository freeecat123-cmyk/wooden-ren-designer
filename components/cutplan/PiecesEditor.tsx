"use client";

import { useState } from "react";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { indexToCode } from "@/lib/cutplan/piece-spec";
import { colorForCode } from "@/lib/cutplan/colors";
import { MATERIALS } from "@/lib/materials";
import type { BillableMaterial, MaterialId, SheetGood } from "@/lib/types";
import { SOLID_WOOD_THICKNESSES, SHEET_THICKNESSES } from "@/lib/cutplan";

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

/**
 * 厚度下拉：依材質類別給預設選項 + 保留當前值（即使不在預設內也顯示）。
 * 要完全自訂的使用者可打開「其他」切到 number input。
 */
function ThicknessSelect({
  value,
  isSheet,
  onChange,
}: {
  value: number;
  isSheet: boolean;
  onChange: (v: number) => void;
}) {
  const presets = isSheet ? SHEET_THICKNESSES : SOLID_WOOD_THICKNESSES;
  const OTHER = "__other__";
  const inPreset = presets.includes(value);
  const [custom, setCustom] = useState(!inPreset && value > 0);

  if (custom) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
        />
        <button
          title="切回下拉"
          onClick={() => setCustom(false)}
          className="text-xs text-zinc-400 hover:text-zinc-700"
        >
          ⇆
        </button>
      </div>
    );
  }

  const options = Array.from(new Set([...presets, value]))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  return (
    <select
      value={inPreset ? value : value}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setCustom(true);
          return;
        }
        onChange(Number(e.target.value));
      }}
      className="w-full px-2 py-1 border border-zinc-200 rounded text-sm text-right"
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
      <option value={OTHER}>其他…</option>
    </select>
  );
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

  /**
   * 拼板分割（兩種模式）：
   * - 平均：輸入整數 N → 每條寬 = ceil(原寬/N) + 10mm 膠合/刨平損耗，數量 × N
   * - 自訂：輸入逗號分隔（例「220,200,220」）→ 拆成 N 個獨立 spec，各自寬度，
   *   不加損耗（使用者自己拿捏）。件數 = 原件數（每張拼板都需要這 N 條）
   */
  const GLUE_ALLOWANCE_MM = 10;

  const stripSplitSuffix = (name: string) =>
    name.replace(/（拼\s*\d+\s*條）\s*$/, "").replace(/（拼板\s*\d+mm）\s*$/, "");

  const splitSpec = (id: string) => {
    const src = specs.find((s) => s.id === id);
    if (!src) return;
    const input = window.prompt(
      [
        `拼板分割——「${src.name}」寬 ${src.width}mm`,
        "",
        "輸入條數（平均，自動 +10mm 損耗）：如 3",
        "或各條寬度（逗號分隔，不加損耗）：如 220,200,220",
      ].join("\n"),
      "3",
    );
    if (input === null) return;
    const trimmed = input.trim();
    const baseName = stripSplitSuffix(src.name);

    if (/[,，]/.test(trimmed)) {
      // 自訂不等寬模式
      const widths = trimmed
        .split(/[,，]/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (widths.length < 2) {
        alert("自訂模式至少要 2 條有效寬度");
        return;
      }
      const newSpecs: PieceSpec[] = widths.map((w, i) => ({
        ...src,
        id: `${src.id}-s${i}`,
        name: `${baseName}（拼板 ${w}mm）`,
        width: w,
        quantity: src.quantity,
      }));
      onChange(specs.flatMap((s) => (s.id === id ? newSpecs : [s])));
      return;
    }

    // 平均模式
    const n = Math.max(2, Math.min(20, parseInt(trimmed, 10) || 0));
    if (n < 2) {
      alert("條數要 ≥ 2");
      return;
    }
    const newWidth = Math.ceil(src.width / n) + GLUE_ALLOWANCE_MM;
    const updated: PieceSpec = {
      ...src,
      name: `${baseName}（拼${n}條）`,
      width: newWidth,
      quantity: src.quantity * n,
    };
    onChange(specs.map((s) => (s.id === id ? updated : s)));
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
                <th className="text-center px-2 py-2 w-10">#</th>
                <th className="text-left px-3 py-2 w-40">名稱</th>
                <th className="text-left px-3 py-2 w-36">材質</th>
                <th className="text-right px-2 py-2 w-20">長</th>
                <th className="text-right px-2 py-2 w-20">寬</th>
                <th className="text-right px-2 py-2 w-24">厚</th>
                <th className="text-right px-2 py-2 w-16">數量</th>
                <th className="text-center px-2 py-2 w-16">旋轉</th>
                <th className="px-2 py-2 w-36"></th>
              </tr>
            </thead>
            <tbody>
              {specs.map((s, idx) => {
                const billableVal =
                  s.billable === "plywood" || s.billable === "mdf"
                    ? s.billable
                    : s.material;
                const code = indexToCode(idx);
                return (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="px-2 py-1 text-center">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-zinc-400 text-zinc-900 text-xs font-bold font-mono"
                        style={{ backgroundColor: colorForCode(code) }}
                      >
                        {code}
                      </span>
                    </td>
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
                      <ThicknessSelect
                        value={s.thickness}
                        isSheet={billableVal === "plywood" || billableVal === "mdf"}
                        onChange={(t) => patchSpec(s.id, { thickness: t })}
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
                        onClick={() => splitSpec(s.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-900 mr-2"
                        title="將寬度平均分成 N 條（拼板用）"
                      >
                        ✂ 分割
                      </button>
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
