import { describe, it, expect } from "vitest";
import type { MachiningFace } from "@/lib/export/mortise-faces";
import { planA4Tiles, CALIBRATION_TEST_LINE_MM } from "./tiling";
import { tileSheetSvg, tilePageGeometry, pageToFace, printerTestPageSvg } from "./tile-sheet";
import { PROOF_RULER_MM } from "./sheet";
import { TILE_MARGIN_MM } from "./tiling";

function rect(w: number, h: number, over: Partial<MachiningFace> = {}): MachiningFace {
  return {
    faceKey: "front",
    faceLabelZh: "正面",
    outline: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    holes: [],
    tenons: [],
    w,
    h,
    ...over,
  };
}

/** 方凳凳腳等級：425×35，橫放會切成 2 欄 1 列。 */
const legFace = rect(425, 35);
const legPlan = planA4Tiles(legFace.w, legFace.h)!;

/** 大板：3 欄 2 列，測角落/接縫/多鄰邊。 */
const bigFace = rect(700, 300);
const bigPlan = planA4Tiles(bigFace.w, bigFace.h)!;

function baseInput(face: MachiningFace, plan = planA4Tiles(face.w, face.h)!, c = 0, r = 0) {
  const tile = plan.tiles.find((t) => t.c === c && t.r === r)!;
  return {
    face,
    plan,
    tile,
    partNo: "P-01a",
    nameZh: "凳腳 1",
    qty: 4,
    faceIndex: 0,
    faceCount: 2,
  };
}

describe("planA4Tiles 前提", () => {
  it("凳腳 425×35 橫放切 2 欄 1 列", () => {
    expect(legPlan.cols).toBe(2);
    expect(legPlan.rows).toBe(1);
  });
  it("700×300 切成多欄多列（用來測四鄰邊情況）", () => {
    expect(bigPlan.cols).toBeGreaterThanOrEqual(2);
    expect(bigPlan.rows).toBeGreaterThanOrEqual(2);
  });
});

describe("tilePageGeometry", () => {
  it("leftX / topY 永遠等於留白（沒有前導重複內容可裁）", () => {
    for (const t of bigPlan.tiles) {
      const g = tilePageGeometry(bigPlan, t);
      expect(g.leftX).toBe(TILE_MARGIN_MM);
      expect(g.topY).toBe(TILE_MARGIN_MM);
    }
  });

  it("有右鄰時 rightX 內縮 10mm（重疊量）；沒有右鄰時 rightX＝紙邊留白", () => {
    const g0 = tilePageGeometry(bigPlan, bigPlan.tiles.find((t) => t.c === 0 && t.r === 0)!);
    expect(g0.hasRight).toBe(true);
    expect(g0.pageW - g0.rightX - TILE_MARGIN_MM).toBeCloseTo(10, 6); // 內縮 overlap

    const gLast = tilePageGeometry(
      bigPlan,
      bigPlan.tiles.find((t) => t.c === bigPlan.cols - 1 && t.r === 0)!,
    );
    expect(gLast.hasRight).toBe(false);
    expect(gLast.rightX).toBe(gLast.pageW - TILE_MARGIN_MM);
  });

  it("有下鄰時 bottomY 內縮 10mm；沒有下鄰時 bottomY＝紙邊留白", () => {
    const g0 = tilePageGeometry(bigPlan, bigPlan.tiles.find((t) => t.c === 0 && t.r === 0)!);
    expect(g0.hasBottom).toBe(true);
    expect(g0.pageH - g0.bottomY - TILE_MARGIN_MM).toBeCloseTo(10, 6);

    const gLast = tilePageGeometry(
      bigPlan,
      bigPlan.tiles.find((t) => t.c === 0 && t.r === bigPlan.rows - 1)!,
    );
    expect(gLast.hasBottom).toBe(false);
    expect(gLast.bottomY).toBe(gLast.pageH - TILE_MARGIN_MM);
  });

  /**
   * 核心正確性：這條鎖住「裁邊＝下一張的對齊線＝同一個 face 座標」。
   * 這是使用者真的把紙裁下、貼齊時，兩張紙會不會準的數學保證——
   * 不是只看畫面像不像，是座標算出來真的相等。
   */
  it("裁切線與下一張對齊線指向同一個 face 座標（欄方向）", () => {
    for (let c = 0; c < bigPlan.cols - 1; c++) {
      const tileA = bigPlan.tiles.find((t) => t.c === c && t.r === 0)!;
      const tileB = bigPlan.tiles.find((t) => t.c === c + 1 && t.r === 0)!;
      const gA = tilePageGeometry(bigPlan, tileA);
      const gB = tilePageGeometry(bigPlan, tileB);
      const faceFromCut = pageToFace(tileA, gA.rightX, gA.topY);
      const faceFromAlign = pageToFace(tileB, gB.leftX, gB.topY);
      expect(faceFromCut.x).toBeCloseTo(faceFromAlign.x, 6);
    }
  });

  it("裁切線與下一張對齊線指向同一個 face 座標（列方向）", () => {
    for (let r = 0; r < bigPlan.rows - 1; r++) {
      const tileA = bigPlan.tiles.find((t) => t.c === 0 && t.r === r)!;
      const tileB = bigPlan.tiles.find((t) => t.c === 0 && t.r === r + 1)!;
      const gA = tilePageGeometry(bigPlan, tileA);
      const gB = tilePageGeometry(bigPlan, tileB);
      const faceFromCut = pageToFace(tileA, gA.leftX, gA.bottomY);
      const faceFromAlign = pageToFace(tileB, gB.leftX, gB.topY);
      expect(faceFromCut.y).toBeCloseTo(faceFromAlign.y, 6);
    }
  });
});

describe("tileSheetSvg", () => {
  it("viewBox 依橫放/直放取正確的 A4 尺寸", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    expect(legPlan.landscape).toBe(true);
    expect(svg).toContain('viewBox="0 0 297 210"');
  });

  it("含 100mm 證明尺", () => {
    expect(PROOF_RULER_MM).toBe(100);
    expect(tileSheetSvg(baseInput(legFace))).toContain("100mm");
  });

  it("絕不輸出 font-weight 500 或 600", () => {
    for (const t of bigPlan.tiles) {
      const svg = tileSheetSvg(baseInput(bigFace, bigPlan, t.c, t.r));
      expect(svg).not.toMatch(/font-weight="(500|600)"/);
    }
  });

  it("字型一律 PackCJK", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    const texts = svg.match(/<text[^>]*font-family="[^"]*"/g) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain('font-family="PackCJK"');
  });

  it("有右鄰的那張：右邊實線裁切線 + 「沿此線裁」；沒有右鄰：不畫", () => {
    const left = tileSheetSvg(baseInput(legFace, legPlan, 0, 0));
    const right = tileSheetSvg(baseInput(legFace, legPlan, 1, 0));
    expect(left).toContain("沿此線裁");
    expect(left).toContain('data-mark="cut-line"');
    expect(right).not.toContain("沿此線裁");
    expect(right).not.toContain('data-mark="cut-line"');
  });

  it("有左鄰的那張：左邊灰色虛線對齊線 + 提示文字；沒有左鄰：不畫", () => {
    const left = tileSheetSvg(baseInput(legFace, legPlan, 0, 0));
    const right = tileSheetSvg(baseInput(legFace, legPlan, 1, 0));
    expect(left).not.toContain("對齊此線");
    expect(right).toContain("對齊此線");
    expect(right).toContain('data-mark="align-line"');
  });

  it("格子編號：欄字母＋列數字，附「共 X 欄 × Y 列」", () => {
    const a1 = tileSheetSvg(baseInput(bigFace, bigPlan, 0, 0));
    const b2 = tileSheetSvg(baseInput(bigFace, bigPlan, 1, 1));
    expect(a1).toContain("A1");
    expect(b2).toContain("B2");
    expect(a1).toContain(`共 ${bigPlan.cols} 欄 × ${bigPlan.rows} 列`);
  });

  it("不用「第 N 張/共 M 張」這種舊格式字樣", () => {
    const svg = tileSheetSvg(baseInput(bigFace, bigPlan, 0, 0));
    expect(svg).not.toMatch(/第 \d+ 張/);
  });

  it("每張都有向上箭頭標記", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    expect(svg).toContain('data-mark="up-arrow"');
  });

  it("四角都有對位十字register mark", () => {
    const svg = tileSheetSvg(baseInput(bigFace, bigPlan, 1, 1)); // 中間格，四鄰都有
    const n = (svg.match(/data-mark="tile-register"/g) ?? []).length;
    expect(n).toBe(4);
  });

  /**
   * 2026-08-20：原本這裡有一條「整組貫穿對角自檢線」，拿放大並排對照（接縫
   * ±40mm、12px/mm，含角度刻意夠斜的 600×150 合成件）實測過，10mm 錯位造成
   * 的轉折在視覺上並不明顯，比不上對位十字／裁切線與對齊線的分離好辨識，
   * 已經拿掉（見 tile-sheet.ts 檔頭說明）。這條測試改守「不要有殘留」，
   * 避免以後有人半途把線加回來又忘記補說明。
   */
  it("不再輸出對角自檢線（已拿掉，見檔頭說明）", () => {
    const svg = tileSheetSvg(baseInput(legFace, legPlan, 0, 0));
    expect(svg).not.toContain('data-mark="diagonal-check"');
  });

  it("零件名稱／件號／面別仍然出現在頁面上", () => {
    const svg = tileSheetSvg(baseInput(legFace));
    expect(svg).toContain("P-01a");
    expect(svg).toContain("凳腳 1");
    expect(svg).toContain("×4");
    expect(svg).toContain("正面");
  });

  it("四角十字與裁切線/對齊線/資訊區塊都在 15mm 內縮框內（不得靠近紙張實體邊緣）", () => {
    // 用中間格（四鄰都有）＋角落格各測一次，涵蓋裁切線在內縮位置、對齊線在留白邊緣兩種情況。
    for (const [c, r] of [[0, 0], [1, 1], [bigPlan.cols - 1, bigPlan.rows - 1]] as const) {
      const g = tilePageGeometry(bigPlan, bigPlan.tiles.find((t) => t.c === c && t.r === r)!);
      expect(g.leftX).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
      expect(g.topY).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
      expect(g.pageW - g.rightX).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
      expect(g.pageH - g.bottomY).toBeGreaterThanOrEqual(TILE_MARGIN_MM);
    }
  });

  it("單一 tile（1×1，無鄰邊）不畫裁切線也不畫對齊線，但仍有四角十字與箭頭", () => {
    const small = rect(150, 80);
    const plan = planA4Tiles(small.w, small.h)!;
    expect(plan.cols).toBe(1);
    expect(plan.rows).toBe(1);
    const svg = tileSheetSvg(baseInput(small, plan, 0, 0));
    expect(svg).not.toContain('data-mark="cut-line"');
    expect(svg).not.toContain('data-mark="align-line"');
    expect((svg.match(/data-mark="tile-register"/g) ?? []).length).toBe(4);
    expect(svg).toContain('data-mark="up-arrow"');
  });
});

/** 從 SVG 取出證明尺自報的保留框（rulerMarkup 的 data-ruler-box）。 */
function rulerBoxFromSvg(svg: string) {
  const m = svg.match(/data-ruler-box="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/);
  if (!m) throw new Error("找不到證明尺");
  return { x0: Number(m[1]), y0: Number(m[2]), x1: Number(m[3]), y1: Number(m[4]) };
}

const RULER_SEAM_CLEARANCE_MM = 12;

/** 這張的哪幾條線是「作用中」的接縫（cut 或 align），連同座標一起列出。 */
function activeSeams(g: ReturnType<typeof tilePageGeometry>) {
  const out: Array<{ axis: "x" | "y"; pos: number }> = [];
  if (g.hasRight) out.push({ axis: "x", pos: g.rightX });
  if (g.hasLeft) out.push({ axis: "x", pos: g.leftX });
  if (g.hasBottom) out.push({ axis: "y", pos: g.bottomY });
  if (g.hasTop) out.push({ axis: "y", pos: g.topY });
  return out;
}

/** 證明尺保留框到一條座標線的最短距離（框如果整段都在線的同一側，距離＝到最近那條邊）。 */
function boxDistanceToLine(box: { x0: number; y0: number; x1: number; y1: number }, seam: { axis: "x" | "y"; pos: number }) {
  if (seam.axis === "x") {
    if (seam.pos >= box.x0 && seam.pos <= box.x1) return 0; // 線穿過框，距離視為 0（絕對要避免）
    return Math.min(Math.abs(seam.pos - box.x0), Math.abs(seam.pos - box.x1));
  }
  if (seam.pos >= box.y0 && seam.pos <= box.y1) return 0;
  return Math.min(Math.abs(seam.pos - box.y0), Math.abs(seam.pos - box.y1));
}

describe("證明尺不得跟裁切線／對齊線擠在一起", () => {
  /**
   * 2026-08-20 coordinator 拿 v2-0（凳腳 Tile A1，1 欄×2 列，下緣同時是唯一的接縫）
   * 截圖抓到：證明尺被排到紙面底部那一條窄帶，跟裁切線的「沿此線裁」文字疊在一起，
   * 使用者有可能真的沿著證明尺裁下去。這裡把 legPlan／bigPlan 每一張都掃一遍，
   * 證明尺保留框跟任何一條作用中的接縫線，距離都必須 ≥ 12mm。
   */
  it("legPlan（每張只有一條接縫）：證明尺離那條接縫至少 12mm", () => {
    for (const tile of legPlan.tiles) {
      const svg = tileSheetSvg(baseInput(legFace, legPlan, tile.c, tile.r));
      const box = rulerBoxFromSvg(svg);
      const g = tilePageGeometry(legPlan, tile);
      for (const seam of activeSeams(g)) {
        expect(
          boxDistanceToLine(box, seam),
          `tile c=${tile.c} r=${tile.r} 證明尺離 ${seam.axis}=${seam.pos} 太近`,
        ).toBeGreaterThanOrEqual(RULER_SEAM_CLEARANCE_MM - 1e-6);
      }
    }
  });

  it("bigPlan（最多三面有接縫）：證明尺離任何一條接縫至少 12mm", () => {
    for (const tile of bigPlan.tiles) {
      const svg = tileSheetSvg(baseInput(bigFace, bigPlan, tile.c, tile.r));
      const box = rulerBoxFromSvg(svg);
      const g = tilePageGeometry(bigPlan, tile);
      for (const seam of activeSeams(g)) {
        expect(
          boxDistanceToLine(box, seam),
          `tile c=${tile.c} r=${tile.r} 證明尺離 ${seam.axis}=${seam.pos} 太近`,
        ).toBeGreaterThanOrEqual(RULER_SEAM_CLEARANCE_MM - 1e-6);
      }
    }
  });

  it("證明尺永遠落在可用區內（沒有因為避接縫而跑出 15mm 框）", () => {
    for (const tile of bigPlan.tiles) {
      const svg = tileSheetSvg(baseInput(bigFace, bigPlan, tile.c, tile.r));
      const box = rulerBoxFromSvg(svg);
      const g = tilePageGeometry(bigPlan, tile);
      expect(box.x0).toBeGreaterThanOrEqual(g.usable.x0 - 1e-6);
      expect(box.x1).toBeLessThanOrEqual(g.usable.x1 + 1e-6);
      expect(box.y0).toBeGreaterThanOrEqual(g.usable.y0 - 1e-6);
      expect(box.y1).toBeLessThanOrEqual(g.usable.y1 + 1e-6);
    }
  });
});

describe("資訊區塊要有拼好後的實際尺寸標註", () => {
  /**
   * 細長件沿長軸切開時最危險的錯誤是「總長不對」（貼太開或重疊太多）——輪廓本身
   * 是兩條平行直線，貼歪了看起來還很正常。對位十字擋得住平移/旋轉錯誤，但使用者
   * 沒有一個「拿捲尺一量就知道對不對」的終點檢查。這行文字就是那個終點檢查，
   * 每一張都要有、數字要是這個 face 的實際 w/h（四捨五入到整數 mm）。
   */
  it("凳腳 fixture（w=425,h=35）：每張都印「拼好後全長 35mm × 全寬 425mm」（全長＝face.h、全寬＝face.w）", () => {
    for (const tile of legPlan.tiles) {
      const svg = tileSheetSvg(baseInput(legFace, legPlan, tile.c, tile.r));
      expect(svg).toContain("拼好後全長 35mm × 全寬 425mm");
    }
  });

  it("數字四捨五入到整數 mm", () => {
    const face = rect(444.6, 34.4);
    const plan = planA4Tiles(face.w, face.h)!;
    const svg = tileSheetSvg(baseInput(face, plan, 0, 0));
    expect(svg).toContain("拼好後全長 34mm × 全寬 445mm");
  });

  it("單一 tile（不用拼接）也要有這行，不是只有多張才印", () => {
    const small = rect(150, 80);
    const plan = planA4Tiles(small.w, small.h)!;
    const svg = tileSheetSvg(baseInput(small, plan, 0, 0));
    expect(svg).toContain("拼好後全長 80mm × 全寬 150mm");
  });
});

describe("printerTestPageSvg", () => {
  it("A4 橫放", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).toContain('viewBox="0 0 297 210"');
  });

  it("含 250mm 校正線（2026-08-20：100mm 誤差太小難量準，改成 250mm，見 tiling.ts CALIBRATION_TEST_LINE_MM）", () => {
    expect(CALIBRATION_TEST_LINE_MM).toBe(250);
    expect(printerTestPageSvg(14)).toContain("250mm");
  });

  it("含四個角標（跟樣板同一顆 register mark）", () => {
    const svg = printerTestPageSvg(14);
    expect((svg.match(/data-mark="tile-register"/g) ?? []).length).toBe(4);
  });

  it("外框畫在 15mm 內縮位置，不是紙張實體邊緣", () => {
    const svg = printerTestPageSvg(14);
    const m = svg.match(/<rect data-mark="test-frame" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    expect(m).toBeTruthy();
    const [, x, y, w, h] = m!.map(Number);
    expect(x).toBe(TILE_MARGIN_MM);
    expect(y).toBe(TILE_MARGIN_MM);
    expect(x + w).toBe(297 - TILE_MARGIN_MM);
    expect(y + h).toBe(210 - TILE_MARGIN_MM);
  });

  it("帶入實際張數", () => {
    expect(printerTestPageSvg(14)).toContain("14");
    expect(printerTestPageSvg(29)).toContain("29");
  });

  it("含操作說明關鍵字（2026-08-20 coordinator 定稿文案，逐字採用）", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).toContain("先印這一張，不要一次印完");
    expect(svg).toContain("250mm");
    expect(svg).toContain("實際大小 / 100%");
    expect(svg).toContain("符合頁面大小");
    // 分流式文案：兩支各自出現，不是舊版單一條件式的「①②」。
    expect(svg).toContain("量起來剛好 250mm");
    expect(svg).toContain("量起來不是 250mm");
    expect(svg).toContain("印表機校正");
    expect(svg).toContain("四個角的十字如果有缺角");
  });

  it("帶入實際張數的分流句子裡（不是舊版「兩項都通過」）", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).toContain("直接把其餘 14 張印完就好");
  });

  it("不得出現 font-weight 500/600、字型一律 PackCJK", () => {
    const svg = printerTestPageSvg(14);
    expect(svg).not.toMatch(/font-weight="(500|600)"/);
    const texts = svg.match(/<text[^>]*font-family="[^"]*"/g) ?? [];
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toContain('font-family="PackCJK"');
  });

  it("所有 <text> 與外框都落在 15mm 內縮框內（不靠近紙張實體邊緣）", () => {
    const svg = printerTestPageSvg(14);
    const xs = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"/g)];
    expect(xs.length).toBeGreaterThan(0);
    for (const [, x, y] of xs) {
      expect(Number(x)).toBeGreaterThanOrEqual(TILE_MARGIN_MM - 1e-6);
      expect(Number(x)).toBeLessThanOrEqual(297 - TILE_MARGIN_MM + 1e-6);
      expect(Number(y)).toBeGreaterThanOrEqual(TILE_MARGIN_MM - 1e-6);
      expect(Number(y)).toBeLessThanOrEqual(210 - TILE_MARGIN_MM + 1e-6);
    }
  });
});

/**
 * 印表機校正（2026-08-20 實機回饋：印出的樣板全長少 2mm，量 100mm 證明尺只有
 * 99.5mm）。s＝量到的/應該的＝99.5/100＝0.995，這裡統一用這個數字驗證。
 */
describe("印表機校正（s 參數）", () => {
  const S = 0.995;

  it("s=1（不傳）跟明確傳 1 完全一樣——不校正時 tilePageGeometry／tileSheetSvg 零改變", () => {
    const tile = legPlan.tiles[0];
    const gDefault = tilePageGeometry(legPlan, tile);
    const gExplicit = tilePageGeometry(legPlan, tile, 1);
    expect(gExplicit).toEqual(gDefault);

    const svgDefault = tileSheetSvg(baseInput(legFace));
    const svgExplicit = tileSheetSvg({ ...baseInput(legFace), s: 1 });
    expect(svgExplicit).toBe(svgDefault);
  });

  it("s=0.995：scale＝1/s，tx/ty 帶入 tile.x/s（不再是純平移）", () => {
    const tile = legPlan.tiles[0];
    const g1 = tilePageGeometry(legPlan, tile, 1);
    const gS = tilePageGeometry(legPlan, tile, S);
    expect(gS.scale).toBeCloseTo(1 / S, 10);
    expect(gS.tx).toBeCloseTo(TILE_MARGIN_MM - tile.x / S, 6);
    expect(gS.ty).toBeCloseTo(TILE_MARGIN_MM - tile.y / S, 6);
    // usable（紙張安全留白）本身跟校正無關，不隨 s 變。
    expect(gS.usable).toEqual(g1.usable);
  });

  it("s=0.995：重疊量在紙面上要畫 10/s（『重疊 10mm 是實際印出來要 10mm』）", () => {
    const tileA = bigPlan.tiles.find((t) => t.c === 0 && t.r === 0)!;
    const gS = tilePageGeometry(bigPlan, tileA, S);
    expect(gS.pageW - gS.rightX - TILE_MARGIN_MM).toBeCloseTo(10 / S, 6);
  });

  it("s=0.995：端到端恆等式——紙面上畫的內容，乘上印表機真實縮放 s，物理長度等於原始 face 長度", () => {
    // 模擬 tileSheetSvg 的 content transform：pageX = tx + (faceX-tile.x) * scale。
    // 印表機把整張紙印出來時，物理長度 = 頁面座標差 × s（印表機自己的縮放）。
    // 這條測試驗證這兩件事疊起來剛好抵銷，物理長度 = face 座標差本身。
    const tile = legPlan.tiles[0];
    const g = tilePageGeometry(legPlan, tile, S);
    const faceX1 = tile.x + 5;
    const faceX2 = tile.x + 200;
    const pageX1 = g.tx + (faceX1 - tile.x) * g.scale;
    const pageX2 = g.tx + (faceX2 - tile.x) * g.scale;
    const printedPhysicalMm = (pageX2 - pageX1) * S;
    expect(printedPhysicalMm).toBeCloseTo(faceX2 - faceX1, 6);
  });

  it("s=0.995：裁切線與下一張對齊線仍解析到同一個 face 座標（欄方向，校正後對位不失準）", () => {
    const planS = planA4Tiles(bigFace.w, bigFace.h, S)!;
    for (let c = 0; c < planS.cols - 1; c++) {
      const tileA = planS.tiles.find((t) => t.c === c && t.r === 0)!;
      const tileB = planS.tiles.find((t) => t.c === c + 1 && t.r === 0)!;
      const gA = tilePageGeometry(planS, tileA, S);
      const gB = tilePageGeometry(planS, tileB, S);
      const faceFromCut = pageToFace(tileA, gA.rightX, gA.topY, S);
      const faceFromAlign = pageToFace(tileB, gB.leftX, gB.topY, S);
      expect(faceFromCut.x).toBeCloseTo(faceFromAlign.x, 6);
    }
  });

  it("s=0.995：裁切線與下一張對齊線仍解析到同一個 face 座標（列方向）", () => {
    const planS = planA4Tiles(bigFace.w, bigFace.h, S)!;
    for (let r = 0; r < planS.rows - 1; r++) {
      const tileA = planS.tiles.find((t) => t.c === 0 && t.r === r)!;
      const tileB = planS.tiles.find((t) => t.c === 0 && t.r === r + 1)!;
      const gA = tilePageGeometry(planS, tileA, S);
      const gB = tilePageGeometry(planS, tileB, S);
      const faceFromCut = pageToFace(tileA, gA.leftX, gA.bottomY, S);
      const faceFromAlign = pageToFace(tileB, gB.leftX, gB.topY, S);
      expect(faceFromCut.y).toBeCloseTo(faceFromAlign.y, 6);
    }
  });

  it("s=0.995：tile 內建的 100mm 證明尺，紙面上畫 100/s，標籤仍寫 100mm", () => {
    const plan = planA4Tiles(legFace.w, legFace.h, S)!;
    const svg = tileSheetSvg({ ...baseInput(legFace, plan, 0, 0), s: S });
    const box = rulerBoxFromSvg(svg);
    const drawnLen = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    expect(drawnLen).toBeCloseTo(PROOF_RULER_MM / S, 2);
    expect(svg).toContain("此線實長 100mm");
    // 校正正確時（印表機真的照 S 縮），印出來量到的會剛好是 100mm——容許 0.05mm
    // 誤差，因為 rulerBoxFromSvg 讀回的是 SVG 字串裡 r2（2 位小數＝0.01mm）
    // 捨入過的座標，不是數學上未捨入的原始值。
    expect(drawnLen * S).toBeCloseTo(PROOF_RULER_MM, 1);
  });

  it("s=0.995：測試頁的 250mm 校正線，紙面上畫 250/s，印出來（×S）剛好 250mm", () => {
    const svg = printerTestPageSvg(14, S);
    const box = rulerBoxFromSvg(svg);
    const drawnLen = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    expect(drawnLen).toBeCloseTo(CALIBRATION_TEST_LINE_MM / S, 2);
    // 同上：0.05mm 容忍度來自 SVG 字串本身的 r2（0.01mm）捨入，不是公式誤差。
    expect(drawnLen * S).toBeCloseTo(CALIBRATION_TEST_LINE_MM, 1);
  });

  it("s=1（預設）：測試頁校正線就是單純的 250mm（還沒校正 / 用來發現問題）", () => {
    const svg = printerTestPageSvg(14);
    const box = rulerBoxFromSvg(svg);
    const drawnLen = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    expect(drawnLen).toBeCloseTo(CALIBRATION_TEST_LINE_MM, 6);
  });
});
