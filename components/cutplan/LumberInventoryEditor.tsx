"use client";

import { useState } from "react";
import type { LumberStock } from "@/lib/cutplan";
import { SOLID_WOOD_THICKNESSES } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { MATERIALS } from "@/lib/materials";
import type { MaterialId } from "@/lib/types";

function LumberThicknessSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const OTHER = "__other__";
  const presets = SOLID_WOOD_THICKNESSES;
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
          onClick={() => setCustom(false)}
          className="text-xs text-zinc-400 hover:text-zinc-700"
          title="切回下拉"
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
      value={value}
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

export function LumberInventoryEditor({
  specs,
  inventory,
  onChange,
}: {
  specs: PieceSpec[];
  inventory: LumberStock[];
  onChange: (next: LumberStock[]) => void;
}) {
  // 檢查哪些 (material, thickness) 在零件裡有用到但沒列 inventory——提示使用者
  const usedMT = new Set<string>();
  for (const s of specs) {
    if (s.billable === "plywood" || s.billable === "mdf") continue;
    usedMT.add(`${s.material}|${s.thickness}`);
  }
  const coveredMT = new Set<string>();
  for (const s of inventory) {
    coveredMT.add(`${s.material}|${s.thickness}`);
  }

  const addRow = () => {
    const first = specs.find((s) => s.billable !== "plywood" && s.billable !== "mdf");
    onChange([
      ...inventory,
      {
        material: (first?.material ?? "maple") as MaterialId,
        thickness: first?.thickness ?? 25,
        length: 1818,
        width: 200,
        count: 1,
      },
    ]);
  };

  const patchRow = (idx: number, partial: Partial<LumberStock>) => {
    onChange(inventory.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  };

  const removeRow = (idx: number) => {
    onChange(inventory.filter((_, i) => i !== idx));
  };

  const quickAdd = (material: MaterialId, thickness: number) => {
    onChange([
      ...inventory,
      { material, thickness, length: 1818, width: 200, count: 1 },
    ]);
  };

  return (
    <section className="border border-zinc-200 rounded-lg overflow-hidden">
      <header className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700">
            實木庫存（多寬度 · 2D 排料）
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1">
            列一筆 = 該材質 × 厚度切到 2D；常見厚度{" "}
            <span className="font-mono">
              {SOLID_WOOD_THICKNESSES.join(" / ")}mm
            </span>{" "}
            = 1&quot; / 1¼&quot; / 1½&quot; / 2&quot; / 3&quot; / 4&quot;
          </p>
        </div>
        <button
          onClick={addRow}
          className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          ＋ 加一筆板才
        </button>
      </header>

      <div className="overflow-x-auto">
        {inventory.length === 0 ? (
          <p className="p-4 text-xs text-zinc-500">
            沒有列任何實木庫存——目前所有實木零件走單寬模式。
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2 w-32">材質</th>
                <th className="text-right px-2 py-2 w-24">厚 (mm)</th>
                <th className="text-right px-2 py-2 w-24">長 (mm)</th>
                <th className="text-right px-2 py-2 w-24">寬 (mm)</th>
                <th className="text-right px-2 py-2 w-20">支數</th>
                <th className="px-2 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((s, idx) => (
                <tr key={idx} className="border-t border-zinc-100">
                  <td className="px-3 py-1">
                    <select
                      value={s.material}
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
                  </td>
                  <td className="px-2 py-1">
                    <LumberThicknessSelect
                      value={s.thickness}
                      onChange={(t) => patchRow(idx, { thickness: t })}
                    />
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
        )}
      </div>

      {/* 快捷：為每個「零件用到但沒列庫存」的 (material, thickness) 丟一筆 */}
      {Array.from(usedMT)
        .filter((k) => !coveredMT.has(k))
        .slice(0, 6)
        .map((k) => {
          const [material, thicknessStr] = k.split("|");
          const t = Number(thicknessStr);
          return (
            <div key={k} className="px-3 py-1.5 border-t border-zinc-100 flex items-center gap-2 text-xs">
              <span className="text-zinc-500">
                提示：{MATERIALS[material as MaterialId]?.nameZh ?? material} × {t}mm 還沒列庫存
              </span>
              <button
                onClick={() => quickAdd(material as MaterialId, t)}
                className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
              >
                快速加一筆
              </button>
            </div>
          );
        })}
    </section>
  );
}
