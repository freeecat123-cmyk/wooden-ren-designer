/**
 * 圓孔的孔軸一律用 `mortiseLocalBox` 算出來的 `depthAxis`（＝範本宣告的入孔面）。
 *
 * 🩸 2026-09-09（乙級第一題抽屜面板 Ø20 指孔）：3D 預覽以前吃 `holeAxisOf` 的「half-extent 最大那軸」猜測，
 * 面板厚 18（hy=9）比孔徑 20（hx=hz=10）小 → 判成 x 軸，變成拿一根 Ø18×20 的圓柱橫著貫穿板高，
 * 正好與正反兩面相切只留 0.04mm 皮，畫面上完全看不出有孔（2D 三視圖與零件圖走另一條路，圖是對的）。
 * 凡是「孔徑 ≥ 板厚」的貫穿孔都會中：托盤兩片側牆手把孔、木盒蓋指孔、工具牆鑿刀孔、虎鉗顎孔。
 */
import { describe, it, expect } from "vitest";
import { BoxGeometry } from "three";
import { subtractMortisesFromGeometry } from "@/lib/render/mortise-csg";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { holeAxisOf } from "@/lib/render/part-geometry";
import type { Mortise, Part } from "@/lib/types";

/** 100 長 × 100 寬 × 18 厚的板，正中央一個 Ø20 貫穿孔（從板面 y 進） */
const panel: Part = {
  id: "panel",
  nameZh: "板",
  material: "pine",
  grainDirection: "length",
  visible: { length: 100, width: 100, thickness: 18 },
  origin: { x: 0, y: 0, z: 0 },
  tenons: [],
  mortises: [
    { origin: { x: 0, y: 0, z: 0 }, depth: 18, length: 20, width: 20, through: true, shape: "round", cosmetic: true },
  ],
};

/** 從 CSG 結果找「離某軸距離 ≈ r」的頂點數（＝圓孔壁） */
function wallVertices(pos: ArrayLike<number>, axis: "x" | "y" | "z", r: number, tol = 0.6): number {
  let n = 0;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    const d = axis === "y" ? Math.hypot(x, z) : axis === "x" ? Math.hypot(y, z) : Math.hypot(x, y);
    if (Math.abs(d - r) < tol) n++;
  }
  return n;
}

describe("圓孔孔軸", () => {
  const m: Mortise = panel.mortises[0];
  const lb = mortiseLocalBox(panel, m);

  it("這正是會騙過 holeAxisOf 的形狀（孔徑 20 > 板厚 18）", () => {
    expect(lb.depthAxis).toBe("y");                        // 範本宣告：從板面進
    expect(holeAxisOf(lb.hx, lb.hy, lb.hz)).toBe("x");     // 舊猜測：判成橫躺
  });

  it("3D 預覽路徑（沒有 strict）挖出來的孔在板面上，孔壁半徑＝10", () => {
    const base = new BoxGeometry(100, 18, 100);
    const cut = subtractMortisesFromGeometry(base, [lb], ["round"], { unitsPerMm: 1 });
    const pos = cut.getAttribute("position").array as ArrayLike<number>;
    // 正確：孔軸 y、孔壁離 y 軸 10
    expect(wallVertices(pos, "y", 10)).toBeGreaterThan(20);
    // 錯誤版的長相：孔軸 x、孔壁離 x 軸 9（板厚一半也是 9，所以門檻放寬到「明顯多於孔壁」才算）
    const wrong = wallVertices(pos, "x", 9);
    expect(wrong).toBeLessThan(wallVertices(pos, "y", 10));
  });

  it("匯出路徑（strict）與預覽路徑挖出同一個孔", () => {
    const posOf = (strict: boolean) => {
      const g = subtractMortisesFromGeometry(new BoxGeometry(100, 18, 100), [lb], ["round"], { unitsPerMm: 1, strict });
      return wallVertices(g.getAttribute("position").array as ArrayLike<number>, "y", 10);
    };
    expect(posOf(false)).toBeGreaterThan(20);
    expect(posOf(true)).toBeGreaterThan(20);
  });
});
