"use client";

import type { NestConfig } from "@/lib/cutplan";

const STOCK_PRESETS = [
  { value: 1212, label: "4 尺 (1212)" },
  { value: 1818, label: "6 尺 (1818)" },
  { value: 2424, label: "8 尺 (2424)" },
  { value: 3030, label: "10 尺 (3030)" },
];

export function CutPlanConfigPanel({
  value,
  onChange,
}: {
  value: NestConfig;
  onChange: (next: NestConfig) => void;
}) {
  const patch = (partial: Partial<NestConfig>) =>
    onChange({ ...value, ...partial });

  const toggleStock = (v: number) => {
    const has = value.lumberLengths.includes(v);
    const next = has
      ? value.lumberLengths.filter((x) => x !== v)
      : [...value.lumberLengths, v].sort((a, b) => a - b);
    if (next.length === 0) return; // 至少保留一種
    patch({ lumberLengths: next });
  };

  return (
    <section className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">排料設定</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-zinc-600 mb-2">
            實木原料長度
            <span className="text-zinc-400">（數量空白 = 不限）</span>
          </p>
          <div className="space-y-1">
            {STOCK_PRESETS.map((p) => {
              const checked = value.lumberLengths.includes(p.value);
              const countVal = value.lumberCounts[p.value] ?? "";
              return (
                <label key={p.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStock(p.value)}
                  />
                  <span className="w-28">{p.label}</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="不限"
                    disabled={!checked}
                    value={countVal}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      const nextCounts = { ...value.lumberCounts };
                      if (e.target.value === "" || !Number.isFinite(n) || n <= 0) {
                        delete nextCounts[p.value];
                      } else {
                        nextCounts[p.value] = n;
                      }
                      patch({ lumberCounts: nextCounts });
                    }}
                    className="w-16 px-2 py-0.5 border border-zinc-200 rounded text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                  />
                  <span className="text-xs text-zinc-400">支</span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-2">板材尺寸（mm）</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="w-8 text-zinc-500">長</span>
              <input
                type="number"
                value={value.sheetSize.length}
                onChange={(e) =>
                  patch({
                    sheetSize: {
                      ...value.sheetSize,
                      length: Number(e.target.value) || 0,
                    },
                  })
                }
                className="w-24 px-2 py-1 border rounded text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-8 text-zinc-500">寬</span>
              <input
                type="number"
                value={value.sheetSize.width}
                onChange={(e) =>
                  patch({
                    sheetSize: {
                      ...value.sheetSize,
                      width: Number(e.target.value) || 0,
                    },
                  })
                }
                className="w-24 px-2 py-1 border rounded text-sm"
              />
            </label>
            <p className="text-[11px] text-zinc-400">4×8 尺標準 2440×1220</p>
            <label className="flex items-center gap-2 text-sm mt-1">
              <span className="w-8 text-zinc-500">張</span>
              <input
                type="number"
                min={0}
                placeholder="不限"
                value={value.sheetCount ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  patch({
                    sheetCount:
                      e.target.value === "" || !Number.isFinite(n) || n <= 0 ? null : n,
                  });
                }}
                className="w-20 px-2 py-1 border rounded text-sm"
              />
            </label>
            <p className="text-[11px] text-zinc-400">空白 = 不限；跨材質共用</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-2">鋸路 kerf（mm）</p>
          <input
            type="number"
            value={value.kerf}
            onChange={(e) => patch({ kerf: Number(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">圓鋸 3、帶鋸 1–2</p>

          <p className="text-xs text-zinc-600 mt-3 mb-1">最小可用餘料（mm）</p>
          <input
            type="number"
            value={value.minWasteMm}
            onChange={(e) => patch({ minWasteMm: Number(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">低於此長度的零頭不計入利用率</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-2">板材旋轉</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.allowSheetRotate}
              onChange={(e) => patch({ allowSheetRotate: e.target.checked })}
            />
            允許 2D 轉 90°
          </label>
          <p className="text-[11px] text-zinc-400 mt-1">
            板材無纖維方向，開可提高利用率。
          </p>
        </div>
      </div>
    </section>
  );
}
