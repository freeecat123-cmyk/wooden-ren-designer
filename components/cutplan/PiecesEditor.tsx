"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { indexToCode, splitSpecPrompt } from "@/lib/cutplan/piece-spec";
import { colorForCode } from "@/lib/cutplan/colors";
import { MATERIALS, materialName } from "@/lib/materials";
import type { BillableMaterial, MaterialId, SheetGood } from "@/lib/types";
import { SOLID_WOOD_THICKNESSES, SHEET_THICKNESSES } from "@/lib/cutplan";

function genId() {
  return `spec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function ThicknessSelect({
  value,
  isSheet,
  onChange,
  switchTitle,
  otherLabel,
}: {
  value: number;
  isSheet: boolean;
  onChange: (v: number) => void;
  switchTitle: string;
  otherLabel: string;
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
          title={switchTitle}
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
      <option value={OTHER}>{otherLabel}</option>
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
  const t = useTranslations("cutPlanApp.pieces");
  const locale = useLocale();
  const [collapsed, setCollapsed] = useState(false);

  const MATERIAL_OPTIONS = Object.values(MATERIALS).map((m) => ({
    id: m.id,
    label: materialName(m.id, locale),
  }));

  const SHEET_GOOD_OPTIONS: Array<{ id: SheetGood; label: string }> = [
    { id: "plywood", label: t("matSheetPlywood") },
    { id: "mdf", label: t("matSheetMdf") },
  ];

  const patchSpec = (id: string, partial: Partial<PieceSpec>) => {
    onChange(specs.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  };

  const removeSpec = (id: string) => {
    onChange(specs.filter((s) => s.id !== id));
  };

  const duplicateSpec = (id: string) => {
    const src = specs.find((s) => s.id === id);
    if (!src) return;
    const copy: PieceSpec = { ...src, id: genId(), quantity: 1, name: src.name + t("copySuffix") };
    onChange([...specs, copy]);
  };

  const splitSpec = (id: string) => splitSpecPrompt(specs, id, onChange);

  const addBlank = () => {
    const base = specs[0];
    const blank: PieceSpec = {
      id: genId(),
      name: t("newPart"),
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
          <h2 className="text-sm font-semibold text-zinc-700">{t("h")}</h2>
          <span className="text-xs text-zinc-500">
            {t("summaryTpl", { specs: specs.length, n: totalCount })}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="px-2 py-1 text-xs bg-white border border-zinc-300 rounded hover:bg-zinc-50"
          >
            {collapsed ? t("expand") : t("collapse")}
          </button>
          <button
            onClick={addBlank}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            {t("addNew")}
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="text-center px-2 py-2 w-10">{t("thCode")}</th>
                <th className="text-left px-3 py-2 w-40">{t("thName")}</th>
                <th className="text-left px-3 py-2 w-36">{t("thMaterial")}</th>
                <th className="text-right px-2 py-2 w-20">{t("thLength")}</th>
                <th className="text-right px-2 py-2 w-20">{t("thWidth")}</th>
                <th className="text-right px-2 py-2 w-24">{t("thThickness")}</th>
                <th className="text-right px-2 py-2 w-16">{t("thQuantity")}</th>
                <th className="text-center px-2 py-2 w-16">{t("thRotate")}</th>
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
                        <optgroup label={t("matSolidGroup")}>
                          {MATERIAL_OPTIONS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label={t("matSheetGroup")}>
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
                        switchTitle={t("thicknessSwitchTitle")}
                        otherLabel={t("thicknessOther")}
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
                        onChange={(e) =>
                          patchSpec(s.id, { allowRotate: e.target.checked })
                        }
                        title={
                          billableVal === "plywood" || billableVal === "mdf"
                            ? t("rotateTitleSheet")
                            : t("rotateTitleSolid")
                        }
                      />
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <button
                        onClick={() => splitSpec(s.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-900 mr-2"
                        title={t("splitTitle")}
                      >
                        {t("split")}
                      </button>
                      <button
                        onClick={() => duplicateSpec(s.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 mr-2"
                        title={t("duplicateTitle")}
                      >
                        {t("duplicate")}
                      </button>
                      <button
                        onClick={() => removeSpec(s.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                        title={t("removeTitle")}
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
      {!collapsed && (
        <div className="md:hidden divide-y divide-zinc-200">
          {specs.map((s, idx) => {
            const billableVal =
              s.billable === "plywood" || s.billable === "mdf"
                ? s.billable
                : s.material;
            const code = indexToCode(idx);
            const isSheet = billableVal === "plywood" || billableVal === "mdf";
            return (
              <div key={s.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-zinc-400 text-zinc-900 text-xs font-bold font-mono shrink-0"
                    style={{ backgroundColor: colorForCode(code) }}
                  >
                    {code}
                  </span>
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => patchSpec(s.id, { name: e.target.value })}
                    placeholder={t("namePh")}
                    className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded text-sm"
                  />
                  <button
                    onClick={() => removeSpec(s.id)}
                    className="px-2 py-1.5 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100 shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblMaterial")}</span>
                  <select
                    value={billableVal}
                    onChange={(e) => setBillable(s.id, e.target.value)}
                    className="w-full px-2 py-1.5 border border-zinc-200 rounded text-sm"
                  >
                    <optgroup label={t("matSolidGroup")}>
                      {MATERIAL_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label={t("matSheetGroup")}>
                      {SHEET_GOOD_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblLength")}</span>
                    <input
                      type="number"
                      value={s.length}
                      onChange={(e) => patchSpec(s.id, { length: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-zinc-200 rounded text-sm text-right"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblWidth")}</span>
                    <input
                      type="number"
                      value={s.width}
                      onChange={(e) => patchSpec(s.id, { width: Number(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-zinc-200 rounded text-sm text-right"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblThickness")}</span>
                    <ThicknessSelect
                      value={s.thickness}
                      isSheet={isSheet}
                      onChange={(t) => patchSpec(s.id, { thickness: t })}
                      switchTitle={t("thicknessSwitchTitle")}
                      otherLabel={t("thicknessOther")}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-700">
                    <span>{t("mobileLblQuantity")}</span>
                    <input
                      type="number"
                      min={1}
                      value={s.quantity}
                      onChange={(e) => patchSpec(s.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-14 px-2 py-1 border border-zinc-200 rounded text-sm text-right"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={s.allowRotate}
                      onChange={(e) => patchSpec(s.id, { allowRotate: e.target.checked })}
                    />
                    <span>{t("mobileRotateLabel")}</span>
                  </label>
                  <button
                    onClick={() => splitSpec(s.id)}
                    className="ml-auto text-xs text-indigo-600 hover:text-indigo-900"
                  >
                    {t("split")}
                  </button>
                  <button
                    onClick={() => duplicateSpec(s.id)}
                    className="text-xs text-zinc-500 hover:text-zinc-900"
                  >
                    {t("duplicate")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
