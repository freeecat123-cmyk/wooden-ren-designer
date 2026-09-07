/** 零件圖（isolate + 榫接層）：弧肩腳在新設定下，畫在腳上的榫眼/榫頭標記有沒有跑到腳的輪廓外面 */
import React from "react";
import { renderToString } from "react-dom/server";
import { FURNITURE_CATALOG } from "../lib/templates";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";
import { OrthoView } from "../lib/render/svg-views";
const CATS = ["stool","bench","tea-table","side-table","low-table","dining-table","desk","dining-chair","bar-stool"];
const TOL = 0.5; let n = 0; const bad: string[] = [];
const VARS: [string, any][] = [["弧肩", {}], ["兩向", { ctTwoWay: true }], ["兩向+橫撐弧", { ctTwoWay: true, ctLowerCove: true }], ["S形+兩向+橫撐弧", { ctTwoWay: true, ctLowerCove: true, ctShoulderCurve: "s-curve" }], ["外斜8+兩向", { ctTwoWay: true, ctSplay: 8 }]];
for (const cat of CATS) {
  const e: any = (FURNITURE_CATALOG as any[]).find(x => x.category === cat);
  const base: any = (e.optionSchema ?? []).reduce((a: any, s: any) => ((a[s.key] = s.defaultValue), a), {});
  for (const [tag, o] of VARS) {
    const d = applyEdgeProtection(e.template({ length: e.defaults.length, width: e.defaults.width, height: e.defaults.height, material: "maple", options: { ...base, legShape: "curved-taper", ...o } }));
    for (const leg of d.parts.filter((p: any) => p.shape?.kind === "curved-taper")) {
      for (const view of ["front", "side", "top"] as const) {
        let svg = renderToString(React.createElement(OrthoView as any, { design: d, view, title: "", titleEn: "", joineryMode: true, showDimensions: false, isolatePartId: leg.id }));
        n++;
        svg = svg.replace(/<defs>[\s\S]*?<\/defs>/g, "").replace(/<clipPath[\s\S]*?<\/clipPath>/g, "");
        // 輪廓 = 面積最大的 polygon
        let best: number[] | null = null, bestA = -1;
        const polys = [...svg.matchAll(/<polygon[^>]*points="([^"]+)"/g)].map(m => m[1].split(/[\s,]+/).filter(Boolean).map(Number));
        for (const p of polys) { const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1); const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)); if (a > bestA) { bestA = a; best = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; } }
        if (!best) { bad.push(`${cat} [${tag}] ${leg.id} ${view}: 找不到輪廓`); continue; }
        // 其他所有 rect / polygon / line 座標都要在輪廓 bbox 內（容許榫頭凸出：腳頂榫 ≤ 40）
        let worst = 0, worstTag = "";
        for (const m of svg.matchAll(/<(rect|polygon|line)\b[^>]*>/g)) {
          const t = m[0]; const nums: number[][] = [];
          if (m[1] === "rect") { const g = (k: string) => +(new RegExp(`\\s${k}="([^"]*)"`).exec(t)?.[1] ?? 0); nums.push([g("x"), g("y")], [g("x") + g("width"), g("y") + g("height")]); }
          else if (m[1] === "line") { const g = (k: string) => +(new RegExp(`\\s${k}="([^"]*)"`).exec(t)?.[1] ?? 0); nums.push([g("x1"), g("y1")], [g("x2"), g("y2")]); }
          else { const p = (/points="([^"]+)"/.exec(t)?.[1] ?? "").split(/[\s,]+/).filter(Boolean).map(Number); for (let i = 0; i + 1 < p.length; i += 2) nums.push([p[i], p[i + 1]]); }
          if (/stroke="#e5e7eb"|stroke="#d4d4d8"|frame|stroke="#ccc"/.test(t)) continue;
          if (m[1] === "rect" && +(/\swidth="([^"]*)"/.exec(t)?.[1] ?? 0) > 300) continue; // 紙框
          for (const [x, y] of nums) { const o = Math.max(best[0] - x, best[1] - y, x - best[2], y - best[3]); if (o > worst) { worst = o; worstTag = t.slice(0, 80); } }
        }
        if (worst > 40) bad.push(`${cat} [${tag}] ${leg.id} ${view}: 有標記跑出輪廓 ${worst.toFixed(1)}mm  ${worstTag}`);
      }
    }
  }
}
console.log(`零件圖掃了 ${n} 張`); for (const b of bad) console.log("  ❌ " + b); console.log(bad.length ? "有問題" : "✅ 全在輪廓內");
