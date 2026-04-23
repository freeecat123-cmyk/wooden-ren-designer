"use client";

import type { NestConfig } from "@/lib/cutplan";

export function CutPlanConfigPanel({
  value,
  onChange,
}: {
  value: NestConfig;
  onChange: (next: NestConfig) => void;
}) {
  const patch = (partial: Partial<NestConfig>) =>
    onChange({ ...value, ...partial });

  return (
    <section className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">排料設定（全域）</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-zinc-600 mb-1">鋸路 kerf（mm）</p>
          <input
            type="number"
            value={value.kerf}
            onChange={(e) => patch({ kerf: Number(e.target.value) || 0 })}
            className="w-24 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">圓鋸 3、帶鋸 1–2</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-1">最小可用餘料（mm）</p>
          <input
            type="number"
            value={value.minWasteMm}
            onChange={(e) => patch({ minWasteMm: Number(e.target.value) || 0 })}
            className="w-24 px-2 py-1 border rounded text-sm"
          />
          <p className="text-[11px] text-zinc-400 mt-1">低於此長度的零頭不計入利用率</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-1">板材旋轉</p>
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
