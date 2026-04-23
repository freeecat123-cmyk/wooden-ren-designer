"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STOCK_PRESETS = [
  { value: 1212, label: "4 尺 (1212mm)" },
  { value: 1818, label: "6 尺 (1818mm)" },
  { value: 2424, label: "8 尺 (2424mm)" },
  { value: 3030, label: "10 尺 (3030mm)" },
];

export function CutPlanConfigForm({
  type,
  designQuery,
  lumberLengths,
  sheetSize,
  kerf,
}: {
  type: string;
  designQuery: string;
  lumberLengths: number[];
  sheetSize: { length: number; width: number };
  kerf: number;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<number>>(new Set(lumberLengths));
  const [sheetL, setSheetL] = useState(sheetSize.length);
  const [sheetW, setSheetW] = useState(sheetSize.width);
  const [kerfMm, setKerfMm] = useState(kerf);

  const toggle = (v: number) => {
    const next = new Set(checked);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setChecked(next);
  };

  const apply = () => {
    const lumberLengthsStr = Array.from(checked).sort((a, b) => a - b).join(",");
    const qp = new URLSearchParams(designQuery);
    qp.set("lumberLengths", lumberLengthsStr);
    qp.set("sheetLength", String(sheetL));
    qp.set("sheetWidth", String(sheetW));
    qp.set("kerf", String(kerfMm));
    router.replace(`/design/${type}/cut-plan?${qp.toString()}`);
  };

  return (
    <section className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">排料設定</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-zinc-600 mb-2">實木原料長度（可複選）</p>
          <div className="space-y-1">
            {STOCK_PRESETS.map((p) => (
              <label key={p.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked.has(p.value)}
                  onChange={() => toggle(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-2">板材尺寸（mm）</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="w-14 text-zinc-500">長</span>
              <input
                type="number"
                value={sheetL}
                onChange={(e) => setSheetL(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-14 text-zinc-500">寬</span>
              <input
                type="number"
                value={sheetW}
                onChange={(e) => setSheetW(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded text-sm"
              />
            </label>
            <p className="text-[11px] text-zinc-400">4×8 尺標準板為 1220 × 2440</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-2">鋸路 kerf（mm）</p>
          <input
            type="number"
            value={kerfMm}
            onChange={(e) => setKerfMm(Number(e.target.value))}
            className="w-20 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">
            一般手持圓鋸 3mm、帶鋸 1–2mm
          </p>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={apply}
          className="px-4 py-1.5 bg-zinc-900 text-white text-sm rounded hover:bg-zinc-700"
        >
          套用設定
        </button>
      </div>
    </section>
  );
}
