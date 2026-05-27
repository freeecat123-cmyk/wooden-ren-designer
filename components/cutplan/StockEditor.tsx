"use client";

import { useTranslations, useLocale } from "next-intl";
import type { StockItem } from "@/lib/cutplan";
import type { PieceSpec } from "@/lib/cutplan/piece-spec";
import { MATERIALS, materialName } from "@/lib/materials";
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
  const t = useTranslations("cutPlanApp.stock");
  const locale = useLocale();
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
    const last = inventory[inventory.length - 1];
    const newRow: StockItem = last
      ? { ...last, count: null }
      : {
          kind: "solid",
          material: "maple",
          thickness: 0,
          length: 3000,
          width: 200,
          count: null,
        };
    onChange([...inventory, newRow]);
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
          length: 3000,
          width: 200,
          count: null,
        },
      ]);
    } else {
      onChange([
        ...inventory,
        {
          kind: meta.kind,
          thickness: 18,
          length: 2400,
          width: 1200,
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
          <h2 className="text-sm font-semibold text-zinc-700">{t("h")}</h2>
          <p className="text-[11px] text-zinc-500 mt-1">
            {inventory.length === 0 ? (
              <span className="text-amber-700 font-semibold">{t("warnEmpty")}</span>
            ) : (
              <>
                {t("introNotEmpty1")}
                <span className="font-semibold">{t("introNotEmpty2")}</span>
                {t("introNotEmpty3")}
                <span className="ml-2 text-emerald-700">{t("introNotEmptyAuto")}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {inventory.length > 0 && (
            <button
              onClick={() => {
                if (confirm(t("confirmClear"))) onChange([]);
              }}
              className="px-3 py-1 text-xs bg-zinc-100 text-zinc-600 rounded hover:bg-zinc-200"
            >
              {t("clearBtn")}
            </button>
          )}
          <button
            onClick={addRow}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            {t("addRow")}
          </button>
        </div>
      </header>

      {inventory.length > 0 && (
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="text-left px-2 py-2 w-20">{t("thKind")}</th>
                <th className="text-left px-2 py-2 w-24">{t("thMaterial")}</th>
                <th className="text-right px-2 py-2 w-24">{t("thLength")}</th>
                <th className="text-right px-2 py-2 w-24">{t("thWidth")}</th>
                <th className="text-right px-2 py-2 w-16">{t("thCount")}</th>
                <th className="px-1 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((s, idx) => (
                <tr key={idx} className="border-t border-zinc-100">
                  <td className="px-2 py-1">
                    <select
                      value={s.kind}
                      onChange={(e) => {
                        const kind = e.target.value as StockItem["kind"];
                        if (kind === "solid") {
                          patchRow(idx, {
                            kind: "solid",
                            material: s.material ?? "maple",
                            length: 1818,
                            width: 200,
                            thickness: s.thickness || 0,
                          });
                        } else {
                          patchRow(idx, {
                            kind,
                            material: undefined,
                            length: 2400,
                            width: 1200,
                            thickness: 18,
                          });
                        }
                      }}
                      className="w-full px-2 py-1 border border-zinc-200 rounded text-sm"
                    >
                      <option value="solid">{t("kindSolid")}</option>
                      <option value="plywood">{t("kindPlywood")}</option>
                      <option value="mdf">{t("kindMdf")}</option>
                    </select>
                  </td>
                  <td className="px-2 py-1">
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
                            {materialName(m.id, locale)}
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
                      list={s.kind === "solid" ? "stock-length-solid" : "stock-length-sheet"}
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
                      list={s.kind === "solid" ? "stock-width-solid" : "stock-width-sheet"}
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
                      placeholder={t("countUnlimited")}
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
      {inventory.length > 0 && (
        <div className="md:hidden divide-y divide-zinc-200">
          {inventory.map((s, idx) => (
            <div key={idx} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400 w-10 shrink-0">
                  {t("mobileLblKind")}
                </span>
                <select
                  value={s.kind}
                  onChange={(e) => {
                    const kind = e.target.value as StockItem["kind"];
                    if (kind === "solid") {
                      patchRow(idx, { kind: "solid", material: s.material ?? "maple", length: 1818, width: 200, thickness: s.thickness || 0 });
                    } else {
                      patchRow(idx, { kind, material: undefined, length: 2400, width: 1200, thickness: 18 });
                    }
                  }}
                  className="flex-1 px-2 py-1.5 border border-zinc-200 rounded text-sm"
                >
                  <option value="solid">{t("kindSolid")}</option>
                  <option value="plywood">{t("kindPlywood")}</option>
                  <option value="mdf">{t("kindMdf")}</option>
                </select>
                <button
                  onClick={() => removeRow(idx)}
                  className="px-2 py-1.5 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100 shrink-0"
                  aria-label={t("removeAria")}
                >
                  ✕
                </button>
              </div>
              {s.kind === "solid" && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-zinc-400 w-10 shrink-0">
                    {t("mobileLblMaterial")}
                  </span>
                  <select
                    value={s.material ?? "maple"}
                    onChange={(e) => patchRow(idx, { material: e.target.value as MaterialId })}
                    className="flex-1 px-2 py-1.5 border border-zinc-200 rounded text-sm"
                  >
                    {Object.values(MATERIALS).map((m) => (
                      <option key={m.id} value={m.id}>{materialName(m.id, locale)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblLength")}</span>
                  <input
                    type="number"
                    value={s.length}
                    onChange={(e) => patchRow(idx, { length: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 border border-zinc-200 rounded text-sm text-right"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblWidth")}</span>
                  <input
                    type="number"
                    value={s.width}
                    onChange={(e) => patchRow(idx, { width: Number(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 border border-zinc-200 rounded text-sm text-right"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold text-zinc-400 mb-0.5">{t("mobileLblCount")}</span>
                  <input
                    type="number"
                    min={0}
                    placeholder={t("countUnlimited")}
                    value={s.count ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patchRow(idx, { count: e.target.value === "" || !Number.isFinite(n) || n <= 0 ? null : n });
                    }}
                    className="w-full px-2 py-1.5 border border-zinc-200 rounded text-sm text-right"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {uncovered.length > 0 && (
        <div className="border-t border-zinc-100 bg-amber-50/40 p-3">
          <p className="text-xs text-zinc-600 mb-2">{t("uncoveredHint")}</p>
          <div className="flex flex-wrap gap-2">
            {uncovered.map((k) => {
              const meta = usedMeta.get(k)!;
              const label =
                meta.kind === "solid"
                  ? meta.material
                    ? materialName(meta.material, locale)
                    : ""
                  : meta.kind === "plywood"
                  ? t("kindPlywood")
                  : t("kindMdf");
              return (
                <button
                  key={k}
                  onClick={() => quickAdd(meta)}
                  className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
                >
                  {t("quickAddPrefix")}{label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <datalist id="stock-length-solid">
        <option value="1818">{t("dataListLengthSolid6ft")}</option>
        <option value="2000">2m</option>
        <option value="2438">{t("dataListLengthSolid8ft")}</option>
        <option value="3000">3m</option>
        <option value="4000">4m</option>
        <option value="5000">5m</option>
        <option value="6000">6m</option>
      </datalist>
      <datalist id="stock-width-solid">
        <option value="100" />
        <option value="150" />
        <option value="180" />
        <option value="200" />
        <option value="250" />
        <option value="300" />
        <option value="400" />
      </datalist>
      <datalist id="stock-length-sheet">
        <option value="2400">{t("dataListLengthSheet48ft")}</option>
        <option value="2440">2440mm</option>
        <option value="2745">{t("dataListLengthSheet9ft")}</option>
      </datalist>
      <datalist id="stock-width-sheet">
        <option value="1220">{t("dataListWidthSheet4ft")}</option>
        <option value="1200">1200mm</option>
        <option value="900" />
      </datalist>
    </section>
  );
}
