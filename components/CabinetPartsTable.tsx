"use client";

import type { FurnitureDesign, Part } from "@/lib/types";
import { categorizePart } from "@/lib/render/categorize-part";

type Row = {
  category: "door" | "drawer" | "divider";
  label: string;
  l: number;
  w: number;
  t: number;
  qty: number;
};

const CATEGORY_TITLE = {
  door: "🚪 門",
  drawer: "🧺 抽屜",
  divider: "═ 層板 / 分隔板",
} as const;

const CATEGORY_STYLE = {
  door: { bar: "bg-fuchsia-400", head: "bg-fuchsia-50", text: "text-fuchsia-900" },
  drawer: { bar: "bg-rose-400", head: "bg-rose-50", text: "text-rose-900" },
  divider: { bar: "bg-orange-400", head: "bg-orange-50", text: "text-orange-900" },
} as const;

function sortedDims(p: Part): [number, number, number] {
  const dims = [
    Math.round(p.visible.length),
    Math.round(p.visible.width),
    Math.round(p.visible.thickness),
  ].sort((a, b) => b - a) as [number, number, number];
  return dims;
}

/** 過濾掉五金/小配件——這些不是切木料，不該進切料表。 */
function isHardware(part: Part): boolean {
  return /-(hinge|pull|handle|knob|pivot|magnet|catch|kicker|stop|筒|軸|鈕|片)(-|$)/i.test(part.id)
    || /合頁|拉環|拉片|拉手|軸承|滾珠|滑軌/.test(part.nameZh);
}

function buildRows(design: FurnitureDesign): Row[] {
  const rows = new Map<string, Row>();
  for (const part of design.parts) {
    const cat = categorizePart(part.id);
    if (cat !== "door" && cat !== "drawer" && cat !== "divider") continue;
    if (isHardware(part)) continue;
    // 同樣 nameZh + 同樣尺寸的合併數量（門上框櫺 ×4、抽屜側板 ×2 等）
    const [l, w, t] = sortedDims(part);
    const key = `${cat}|${part.nameZh}|${l}x${w}x${t}`;
    const existing = rows.get(key);
    if (existing) {
      existing.qty += 1;
    } else {
      rows.set(key, { category: cat as Row["category"], label: part.nameZh, l, w, t, qty: 1 });
    }
  }
  return Array.from(rows.values());
}

/**
 * 櫃類專用：在三視圖旁邊列出門/抽屜/層板的尺寸表，方便師傅切料。
 * 沒有任何 door/drawer/divider 件時不渲染（桌椅類自動隱藏）。
 */
export function CabinetPartsTable({ design }: { design: FurnitureDesign }) {
  const rows = buildRows(design);
  if (rows.length === 0) return null;

  const grouped: Record<Row["category"], Row[]> = { door: [], drawer: [], divider: [] };
  for (const r of rows) grouped[r.category].push(r);

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="px-3 py-2 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-700">
        📋 部件清單（門 / 抽屜 / 層板）
      </div>
      <div className="divide-y divide-zinc-100 text-[11px]">
        {(["door", "drawer", "divider"] as const).map((cat) => {
          if (grouped[cat].length === 0) return null;
          const style = CATEGORY_STYLE[cat];
          return (
            <div key={cat}>
              <div className={`flex items-center gap-2 px-2 py-1 ${style.head}`}>
                <span className={`w-1 h-3 rounded ${style.bar}`} aria-hidden />
                <span className={`font-medium ${style.text}`}>
                  {CATEGORY_TITLE[cat]} <span className="opacity-60">({grouped[cat].length} 種)</span>
                </span>
              </div>
              <table className="w-full">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="text-left px-2 py-1 font-normal">名稱</th>
                    <th className="text-right px-2 py-1 font-normal tabular-nums">長×寬</th>
                    <th className="text-right px-2 py-1 font-normal tabular-nums">厚</th>
                    <th className="text-right px-2 py-1 font-normal tabular-nums">數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {grouped[cat].map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="px-2 py-1 text-zinc-800 truncate max-w-[180px]" title={r.label}>{r.label}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-zinc-700">{r.l}×{r.w}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-zinc-700">{r.t}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-zinc-900 font-medium">{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
      <div className="px-2 py-1.5 text-[10px] text-zinc-500 bg-zinc-50 border-t border-zinc-100">
        尺寸已依長 / 寬 / 厚降冪排序（最長那邊在前）
      </div>
    </div>
  );
}
