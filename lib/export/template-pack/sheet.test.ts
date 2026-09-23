import { describe, it, expect } from "vitest";
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { templateSheetSvg, contentCornersOnPage, PROOF_RULER_MM } from "./sheet";
import { PAPERS } from "./paper";
import { placeOnLadder } from "./fit";

const A3 = PAPERS.find((p) => p.id === "A3")!;

/** 外層內容 group 的收尾（自成一行）。直接找 "</g>" 會撞到中心十字的內層 group。 */
const OUTER_G = "\n  </g>";

function rect(w: number, h: number, over: Partial<MachiningFace> = {}): MachiningFace {
  return {
    faceKey: "flat",
    faceLabelZh: "攤平面",
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    holes: [],
    tenons: [],
    w,
    h,
    ...over,
  };
}

const face: MachiningFace = rect(400, 80, {
  holes: [
    { kind: "rect", pts: [{ x: 20, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 40 }, { x: 20, y: 40 }], through: false, label: "榫眼" },
    { kind: "circle", cx: 300, cy: 40, r: 4, through: true, label: "螺絲孔" },
  ],
});

const base = {
  face,
  placement: { paper: A3, angleDeg: 0, swapped: false },
  partNo: "P-02",
  nameZh: "牙條",
  qty: 4,
};

/** 凳腳：35×445，A3 直放斜擺——名稱放不進輪廓、尺曾經被壓在腳的下端。 */
const legFace = rect(35, 445, { faceKey: "front", faceLabelZh: "正面" });
const legPlacement = placeOnLadder(legFace.w, legFace.h, PAPERS)!;

describe("templateSheetSvg", () => {
  it("viewBox 就是紙張尺寸（mm）", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain('viewBox="0 0 420 297"');
  });

  it("紙張直放時 viewBox 長短邊對調", () => {
    const svg = templateSheetSvg({ ...base, placement: { paper: A3, angleDeg: 0, swapped: true } });
    expect(svg).toContain('viewBox="0 0 297 420"');
  });

  it("畫出輪廓、方榫孔與圓孔", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain("<path");
    expect(svg).toContain("<circle");
  });

  it("輪廓線寬 0.3mm（列印看得見，不是雷切的 0.1）", () => {
    expect(templateSheetSvg(base)).toContain('stroke-width="0.3"');
  });

  it("含 100mm 證明尺與標示", () => {
    const svg = templateSheetSvg(base);
    expect(PROOF_RULER_MM).toBe(100);
    expect(svg).toContain("100mm");
  });

  it("部件名稱與件號有出現", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain("牙條");
    expect(svg).toContain("P-02");
    expect(svg).toContain("×4");
  });

  it("絕不輸出 font-weight 500 或 600（svg2pdf 會讓中文變亂碼）", () => {
    const svg = templateSheetSvg(base);
    expect(svg).not.toMatch(/font-weight="(500|600)"/);
  });

  it("斜擺時輸出 rotate transform", () => {
    const svg = templateSheetSvg({ ...base, placement: { paper: A3, angleDeg: 21, swapped: false } });
    expect(svg).toContain("rotate(21");
  });

  it("圓孔要有中心十字，方便點中心", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toContain('data-mark="center-cross"');
  });
});

describe("面別標示", () => {
  it("面別一定印在紙上", () => {
    const svg = templateSheetSvg({ ...base, face: { ...face, faceLabelZh: "右端" } });
    expect(svg).toContain("右端");
  });

  it("多加工面時加一行「第 N 面 / 共 M 面」", () => {
    const svg = templateSheetSvg({ ...base, faceIndex: 1, faceCount: 2 });
    expect(svg).toContain("第 2 面 / 共 2 面");
  });

  it("單面時不出現第 N 面字樣", () => {
    expect(templateSheetSvg(base)).not.toContain("共 1 面");
  });

  it("窄零件（名稱放不下）也要在輪廓內留下面別記號，裁下來才不會貼錯 90°", () => {
    const svg = templateSheetSvg({
      face: legFace, placement: legPlacement, partNo: "P-01a", nameZh: "凳腳 1", qty: 4,
      faceIndex: 0, faceCount: 2,
    });
    // 輪廓內的記號畫在旋轉的 <g> 裡；名稱牌畫在 </g> 之後的紙面層。
    const inGroup = svg.slice(svg.indexOf("<g transform"), svg.indexOf(OUTER_G));
    expect(inGroup).toContain("【正面】");
  });
});

describe("名稱不得壓在輪廓線上", () => {
  it("窄零件的名稱改放紙面空白角 + 引線，不畫在輪廓內", () => {
    const svg = templateSheetSvg({
      face: legFace, placement: legPlacement, partNo: "P-01a", nameZh: "凳腳 1", qty: 4,
      faceIndex: 0, faceCount: 2,
    });
    const inGroup = svg.slice(svg.indexOf("<g transform"), svg.indexOf(OUTER_G));
    // "P-01a 凳腳 1 ×4　【正面】" 約 74mm，遠寬於 35mm 的腳 → 不能出現在輪廓群組裡
    expect(inGroup).not.toContain("P-01a");
    expect(svg).toContain("P-01a");
    expect(svg).toContain('data-mark="label-leader"');
  });

  it("寬零件的名稱仍放輪廓內（不必要的引線只會礙眼）", () => {
    const svg = templateSheetSvg(base);
    const inGroup = svg.slice(svg.indexOf("<g transform"), svg.indexOf(OUTER_G));
    expect(inGroup).toContain("P-02");
    expect(svg).not.toContain('data-mark="label-leader"');
  });

  it("判斷用的是 face.w 不是 face.h：w 窄 h 高一定放外面", () => {
    // 舊 bug：`face.h >= 12` → 35×445 判成放得下，字橫跨兩條長邊壓在輪廓上。
    const tall = templateSheetSvg({
      face: rect(20, 400), placement: { paper: A3, angleDeg: 0, swapped: false },
      partNo: "P-09", nameZh: "立柱", qty: 2,
    });
    const wide = templateSheetSvg({
      face: rect(400, 20), placement: { paper: A3, angleDeg: 0, swapped: false },
      partNo: "P-09", nameZh: "立柱", qty: 2,
    });
    expect(tall.slice(tall.indexOf("<g transform"), tall.indexOf(OUTER_G))).not.toContain("P-09");
    expect(wide.slice(wide.indexOf("<g transform"), wide.indexOf(OUTER_G))).toContain("P-09");
  });
});

/** 證明尺的保留框（SVG 自報 data-ruler-box；下面另有一條測試核對它跟實際線段一致）。 */
function rulerBoxFromSvg(svg: string) {
  const m = svg.match(/data-ruler-box="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  if (!m) throw new Error("找不到證明尺");
  return { x0: Number(m[1]), y0: Number(m[2]), x1: Number(m[3]), y1: Number(m[4]) };
}

/** 尺主線的兩個端點（紙面絕對座標，沒有包 transform）。 */
function rulerLineFromSvg(svg: string) {
  const m = svg.match(
    /data-mark="proof-ruler"[\s\S]*?<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/,
  );
  if (!m) throw new Error("找不到證明尺主線");
  return { x1: Number(m[1]), y1: Number(m[2]), x2: Number(m[3]), y2: Number(m[4]) };
}

/** 兩個凸多邊形相交（SAT）。判定要拿真正的旋轉四邊形，不是它的 AABB。 */
function hits(a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      const nx = -(p2.y - p1.y), ny = p2.x - p1.x;
      const proj = (pts: typeof a) => pts.map((p) => p.x * nx + p.y * ny);
      const pa = proj(a), pb = proj(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

const boxPts = (b: { x0: number; y0: number; x1: number; y1: number }) => [
  { x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 },
];

describe("證明尺不得與內容重疊", () => {
  it("內容壓到左下角時，尺自動換到別的空白角", () => {
    const svg = templateSheetSvg({
      face: legFace, placement: legPlacement, partNo: "P-01a", nameZh: "凳腳 1", qty: 4,
      faceIndex: 0, faceCount: 2,
    });
    expect(hits(contentCornersOnPage(legFace, legPlacement), boxPts(rulerBoxFromSvg(svg)))).toBe(false);
  });

  it("上下白邊塞不下橫尺時，改用直式（幾乎鋪滿整張紙的桌面板）", () => {
    // 450×400 在 A2（594×420）：上下各剩 10mm 放不下 11mm 的橫尺，左右各 72mm 放得下直尺。
    const A2 = PAPERS.find((p) => p.id === "A2")!;
    const panel = rect(450, 400);
    const placement = { paper: A2, angleDeg: 0, swapped: false };
    const svg = templateSheetSvg({ face: panel, placement, partNo: "P-01", nameZh: "桌面板", qty: 1 });
    expect(hits(contentCornersOnPage(panel, placement), boxPts(rulerBoxFromSvg(svg)))).toBe(false);
    const line = rulerLineFromSvg(svg);
    expect(Math.abs(line.x2 - line.x1)).toBeCloseTo(0, 6);           // 垂直
    expect(Math.abs(line.y2 - line.y1)).toBeCloseTo(PROOF_RULER_MM, 6); // 仍然實長 100mm
  });

  it("整張紙都被內容佔滿時，尺仍畫得出來（不丟不越界）", () => {
    // A3 橫放幾乎鋪滿：橫式直式所有候選都被壓住 → fallback，但尺必須還在紙內。
    const big = rect(408, 285);
    const svg = templateSheetSvg({
      face: big, placement: { paper: A3, angleDeg: 0, swapped: false },
      partNo: "P-01", nameZh: "座板", qty: 1,
    });
    const rb = rulerBoxFromSvg(svg);
    expect(rb.x0).toBeGreaterThanOrEqual(0);
    expect(rb.x1).toBeLessThanOrEqual(A3.w);
    expect(rb.y1).toBeLessThanOrEqual(A3.h);
  });

  it("尺主線永遠實長 100mm，且落在自報的 data-ruler-box 內", () => {
    for (const svg of [
      templateSheetSvg(base),
      templateSheetSvg({ face: legFace, placement: legPlacement, partNo: "P-01a", nameZh: "凳腳 1", qty: 4 }),
      templateSheetSvg({
        face: rect(450, 400), placement: { paper: PAPERS.find((p) => p.id === "A2")!, angleDeg: 0, swapped: false },
        partNo: "P-01", nameZh: "桌面板", qty: 1,
      }),
    ]) {
      const l = rulerLineFromSvg(svg);
      expect(Math.hypot(l.x2 - l.x1, l.y2 - l.y1)).toBeCloseTo(PROOF_RULER_MM, 6);
      const b = rulerBoxFromSvg(svg);
      for (const p of [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }]) {
        expect(p.x).toBeGreaterThanOrEqual(b.x0 - 1e-6);
        expect(p.x).toBeLessThanOrEqual(b.x1 + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(b.y0 - 1e-6);
        expect(p.y).toBeLessThanOrEqual(b.y1 + 1e-6);
      }
    }
  });

  it("尺畫成灰色虛線，跟要描的黑色輪廓一眼分得出來", () => {
    const svg = templateSheetSvg(base);
    expect(svg).toMatch(/data-mark="proof-ruler"[^>]*stroke="#666"/);
    expect(svg).toContain("stroke-dasharray");
  });
});

/**
 * 旋轉平移守門測試。
 *
 * sheetLayout 那條 `tx = offX + face.h * Math.sin(t)` 改成 `-` 的話，內容會整個
 * 飛出紙外，但輪廓、榫孔、文字、證明尺、字重檢查全都還在 —— 上面所有測試與
 * `npm run verify:template` 都是全綠。這個測試是唯一會紅的地方，別刪。
 */
describe("旋轉後內容必須整個落在紙內", () => {
  const cases: Array<[number, number, number, boolean]> = [
    [400, 80, 0, false],
    [400, 80, 21, false],
    [200, 200, 45, false],
    [150, 400, 0, true],
    [35, 445, 28, true],
    [300, 100, 45, true],
  ];

  for (const [w, h, angleDeg, swapped] of cases) {
    it(`${w}×${h} @${angleDeg}° ${swapped ? "直放" : "橫放"}`, () => {
      const placement = { paper: A3, angleDeg, swapped };
      const pageW = swapped ? A3.h : A3.w;
      const pageH = swapped ? A3.w : A3.h;
      const corners = contentCornersOnPage(rect(w, h), placement);
      expect(corners).toHaveLength(4);
      for (const p of corners) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-6);
        expect(p.x).toBeLessThanOrEqual(pageW + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(-1e-6);
        expect(p.y).toBeLessThanOrEqual(pageH + 1e-6);
      }
    });
  }

  it("四角要真的置中（不是縮成一點剛好通過範圍檢查）", () => {
    const placement = { paper: A3, angleDeg: 21, swapped: false };
    const corners = contentCornersOnPage(rect(400, 80), placement);
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    // 左右留白相等、上下留白相等 → 真的置中
    expect(Math.min(...xs)).toBeCloseTo(A3.w - Math.max(...xs), 6);
    expect(Math.min(...ys)).toBeCloseTo(A3.h - Math.max(...ys), 6);
  });

  it("實際 SVG 的 transform 與 contentCornersOnPage 用同一組數字", () => {
    const placement = { paper: A3, angleDeg: 21, swapped: false };
    const f = rect(400, 80);
    const svg = templateSheetSvg({ ...base, face: f, placement });
    const m = svg.match(/translate\((-?[\d.]+) (-?[\d.]+)\) rotate/);
    expect(m).toBeTruthy();
    const corners = contentCornersOnPage(f, placement);
    // local (0,0) 轉出來就是 translate 量
    expect(Number(m![1])).toBeCloseTo(corners[0].x, 1);
    expect(Number(m![2])).toBeCloseTo(corners[0].y, 1);
  });
});
