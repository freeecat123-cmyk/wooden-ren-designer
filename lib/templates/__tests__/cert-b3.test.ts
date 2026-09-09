/**
 * 乙級第三題 cert-b3：官方數字逐項（工作圖 PDF 第 17 頁 × 評審表第 9 頁 × 材料表第 6 頁）。
 *
 * ⭐ 期望值全部用**官方尺寸鏈**手算（X 0~450 由面板左緣、Y 0~450 由地面、Z 0~360 由正面），
 *    不是把程式輸出貼上來。座標類斷言只證明「程式照 EXAM 算對了」，抓不到「EXAM 讀錯圖」——
 *    真正抓得到的是下面的**尺寸鏈斷言**（鏈的節點與總和都是官方標的）與**部位數斷言**。
 *    這是乙級第二題那輪四位檢查員換來的教訓。
 */
import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { findOverlaps, worldAABB } from "@/lib/geometry/overlap";
import { auditJoints } from "@/lib/joinery/audit-joints";
import { planAssembly } from "@/lib/assembly/plan";
import { buildWorldMortiseIndex, matchMortiseForTenon, tenonWorld } from "@/lib/assembly/joint-world";
import { mortiseLocalBox } from "@/lib/render/svg-views";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-b3")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-b3 官方尺寸", () => {
  const d = build();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  /** 世界座標 → 圖面座標（x+225、y 不變、z+180） */
  const g = (id: string) => {
    const b = worldAABB(part(id));
    return [b.min.x + 225, b.max.x + 225, b.min.y, b.max.y, b.min.z + 180, b.max.z + 180].map(r1);
  };

  it("評審表尺寸：總高 450／總寬（腳跨距）434／總深 360／腳座上端 240／腳柱 45×32", () => {
    expect(d.overall).toEqual({ length: 450, width: 360, thickness: 450 });   // 面板 450 寬（比腳跨距兩側各多懸挑 8）
    // 腳外到腳外 ＝ 434 ＝ 評審表「總寬度」
    expect(r1(g("leg-right-back")[1] - g("leg-left-front")[0])).toBe(434);
    // 腳頂展開 240、腳底展開 360（＝總深）；腳柱 32 寬 × 45 深
    const lf = worldAABB(part("leg-left-front")), lb = worldAABB(part("leg-left-back"));
    expect(r1(lb.max.z - lf.min.z), "腳底展開＝總深 360").toBe(360);
    expect(g("leg-left-front").slice(0, 2)).toEqual([8, 40]);                 // 32 寬
    expect(r1(lf.max.z - lf.min.z), "斜腳的 AABB 深＝45 ＋ 外撇 60").toBe(105);
  });

  it("A-A 寬度鏈 8｜32｜18｜5｜324｜5｜18｜32｜8 ＝ 450（節點與總和都是官方標的）", () => {
    const chain = [8, 32, 18, 5, 324, 5, 18, 32, 8];
    expect(chain.reduce((a, b) => a + b, 0)).toBe(450);
    // 逐個節點對到實際零件的邊界
    let x = 0;
    const nodes = chain.map((v) => (x += v));
    expect(nodes).toEqual([8, 40, 58, 63, 387, 392, 410, 442, 450]);
    expect(g("leg-left-front").slice(0, 2)).toEqual([nodes[0], nodes[1]]);
    expect(g("side-panel-left").slice(0, 2)).toEqual([nodes[1], nodes[2]]);
    expect(g("leg-right-back").slice(0, 2)).toEqual([nodes[6], nodes[7]]);
    // 抽屜**箱體**外寬 324（評審表量的是這個）＝兩片側板外面
    expect(r1(g("drawer-1-side-right")[1] - g("drawer-1-side-left")[0]), "抽屜箱體外寬 324").toBe(324);
    expect([g("drawer-1-side-left")[0], g("drawer-1-side-right")[1]]).toEqual([nodes[3], nodes[4]]);
    // 抽屜**前板**是面付式 370（兩端與腳內面齊），背面貼側板前緣當擋塊
    expect(g("drawer-1-front").slice(0, 2), "前板 370 面付").toEqual([nodes[1], nodes[6]]);
    expect(r1(g("drawer-1-front")[1] - g("drawer-1-front")[0])).toBe(370);
    // 擋塊：前板背面 Z=28 ＝ 側板前封邊正面
    expect(g("drawer-1-front")[5]).toBe(28);
    expect(g("side-edge-left-front")[4]).toBe(28);
  });

  it("尺寸鏈全部加得起來（讀錯圖就會紅）", () => {
    const chain = (v: number[]) => v.slice(1).map((x, i) => r1(Math.abs(x - v[i])));
    // C-C 深度：52｜128｜128｜52 ＝ 360（節點就是側板↔面板的 3 支木釘）
    const sideZ = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-top-side-0"))
      .map((p) => r1((worldAABB(p).min.z + worldAABB(p).max.z) / 2 + 180)))].sort((a, b) => a - b);
    expect(chain([0, ...sideZ, 360]), "C-C 360 鏈").toEqual([52, 128, 128, 52]);
    // B-B：背板↔面板 3 支木釘 25｜142｜142｜25 ＝ 334（背板長）
    const backX = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-top-back-"))
      .map((p) => r1((worldAABB(p).min.x + worldAABB(p).max.x) / 2 + 225)))].sort((a, b) => a - b);
    expect(chain([58, ...backX, 392]), "B-B 334 鏈").toEqual([25, 142, 142, 25]);
    // C-C：背板↔側板 2 支 28｜76｜28 ＝ 132（盒體高）
    const bsY = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-back-side-0"))
      .map((p) => r1((worldAABB(p).min.y + worldAABB(p).max.y) / 2)))].sort((a, b) => b - a);
    expect(chain([432, ...bsY, 300]), "C-C 132 鏈").toEqual([28, 76, 28]);
    // C-C：抽屜前板 2 支 27｜76｜27 ＝ 130
    const dfY = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-drawer-front-0"))
      .map((p) => r1((worldAABB(p).min.y + worldAABB(p).max.y) / 2)))].sort((a, b) => b - a);
    expect(chain([430, ...dfY, 300]), "C-C 130 鏈").toEqual([27, 76, 27]);
    // C-C：抽屜後板 2 支 30｜47｜30 ＝ 107
    const dbY = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-drawer-back-0"))
      .map((p) => r1((worldAABB(p).min.y + worldAABB(p).max.y) / 2)))].sort((a, b) => b - a);
    expect(chain([422, ...dbY, 315]), "C-C 107 鏈").toEqual([30, 47, 30]);
    // C-C：面板 18｜間隙 2｜抽屜前板 130 ＝ 150（面板頂 450 → 抽屜前板底 300）
    expect(chain([450, 432, 430, 300])).toEqual([18, 2, 130]);
    // C-C：側板頂→後板頂 5｜**後板本身 107**｜底板頂→側板底 15 ＝ 127（＝抽屜側板高）
    expect(chain([427, 422, 315, 300])).toEqual([5, 107, 15]);
    expect(5 + 107 + 15).toBe(127);
    // 後板的木釘鏈 30｜47｜30 ＝ 107 剛好等於板高（後板若是 122 這條鏈封不起來）
    expect(30 + 47 + 30).toBe(107);
    expect(r1(g("drawer-1-back")[3] - g("drawer-1-back")[2]), "後板高 107").toBe(107);
    // 側視：面板頂→腳頂 40｜腳高 410 ＝ 450
    expect(chain([450, 410, 0])).toEqual([40, 410]);
    // 木釘 Ø8×30：入面 12｜入端 18 ＝ 30
    expect(12 + 18).toBe(30);
    // 腳斷面：下橫桿在腳 45 深裡置中 10.5｜24｜10.5
    expect(10.5 + 24 + 10.5).toBe(45);
    // 下橫桿榫：7｜10｜7 ＝ 24（榫厚 10 是圖上唯一標到的榫尺寸）
    expect(7 + 10 + 7).toBe(24);
  });

  it("部位數：腳 4、下橫桿 2、上橫檔 2、榫頭 8、木釘 21、底板槽 3、零件 48", () => {
    expect(d.parts.filter((p) => /^leg-/.test(p.id))).toHaveLength(4);
    expect(d.parts.filter((p) => /^rail-(front|back)$/.test(p.id)), "下橫桿 45×24 兩支").toHaveLength(2);
    expect(d.parts.filter((p) => /^top-rail-/.test(p.id)), "腳座上橫檔兩支").toHaveLength(2);
    // 評審表「榫接密合 60」照第一、二題的「榫頭×4 面肩」該是 15 個，但圖上只有 8 個；
    // 本題其餘四項部位數與圖面實體數完全吻合，依須知第七條以圖為準。詳見檔頭。
    expect(d.parts.flatMap((p) => p.tenons), "上橫檔 2×2 ＋ 下橫桿 2×2").toHaveLength(8);
    // 評審表「木釘 21」——圖上數得出來的 21 支，與官方一字不差
    const dowels = d.parts.filter((p) => p.visual === "dowel");
    expect(dowels).toHaveLength(21);
    expect(dowels.filter((p) => p.id.startsWith("dowel-top-back-")), "背板→面板 3").toHaveLength(3);
    expect(dowels.filter((p) => p.id.startsWith("dowel-top-side-")), "側板→面板 6").toHaveLength(6);
    expect(dowels.filter((p) => p.id.startsWith("dowel-back-side-")), "背板↔側板 4").toHaveLength(4);
    expect(dowels.filter((p) => p.id.startsWith("dowel-drawer-front-")), "抽屜前板↔側板 4").toHaveLength(4);
    expect(dowels.filter((p) => p.id.startsWith("dowel-drawer-back-")), "抽屜後板↔側板 4").toHaveLength(4);
    // 評審表「木釘密合 18」＝ 9 處接合 × 2
    expect(3 + 6 + 4 + 4 + 4).toBe(21);
    expect(9 * 2).toBe(18);
    // 評審表「抽屜底板槽 3」＝ 前板 ＋ 兩側板（後板沒有槽，底板從後板底下穿過）
    const grooves = d.parts.flatMap((p) => p.mortises.filter((m) => (m.label ?? "").includes("底板槽")).map(() => p.id));
    expect(grooves.sort()).toEqual(["drawer-1-front", "drawer-1-side-left", "drawer-1-side-right"]);
    expect(d.parts).toHaveLength(48);
  });

  it("⭐本題沒有鳩尾榫（六題唯一）——抽屜四角全是木釘", () => {
    expect(d.parts.some((p) => p.shape?.kind === "dovetail-ends"), "評審表沒有鳩尾兩列").toBe(false);
    // 抽屜四角各 2 支木釘，共 8 支
    expect(d.parts.filter((p) => /^dowel-drawer-/.test(p.id))).toHaveLength(8);
  });

  it("材料表白名單：本題不發 21.5 那支料 → 不可以有 21mm 厚的零件", () => {
    const legal = new Set([32, 45, 24, 18, 15, 8, 4, 60, 11, 14]);   // 60＝上橫檔高、11×14＝滑條
    const bad = d.parts.filter((p) => p.visual !== "dowel")
      .map((p) => Math.min(p.visible.length, p.visible.width, p.visible.thickness))
      .filter((t) => !legal.has(t));
    expect(bad, "出現材料表發不出來的厚度").toEqual([]);
  });

  it("零件關鍵位置（世界座標換算回圖面）", () => {
    expect(g("top-core")).toEqual([8, 442, 432, 450, 8, 352]);            // 木心板心材 434×344×18
    expect(g("top-rail-left")).toEqual([8, 40, 350, 410, 105, 255]);      // 60 高、頂面與腳頂齊
    expect(g("rail-front")).toEqual([40, 410, 255, 300, 51.1, 75.1]);     // 前檔頂＝盒底 300
    expect(g("rail-back")).toEqual([40, 410, 55, 100, 314.2, 338.2]);     // 後檔頂離地 100
    expect(g("side-panel-left")).toEqual([40, 58, 300, 432, 36, 332]);
    expect(g("back-panel")).toEqual([58, 392, 300, 432, 322, 340]);
    expect(g("drawer-1-front")).toEqual([40, 410, 300, 430, 10, 28]);   // 面付式 370 寬
    expect(g("drawer-1-side-left")).toEqual([63, 78, 300, 427, 28, 310]); // 抽屜外深 300 ＝ 10 → 310
    // 後板 107 高、坐在合板底板上面（Y 315~422）——不是一路到 300
    expect(g("drawer-1-back")).toEqual([78, 372, 315, 422, 295, 310]);
    // 底板 308×289×4：兩側各入側板槽 7、前端入前板槽 7、後緣延到後板後面 310（螺釘才鎖得到）
    expect(g("drawer-1-bottom")).toEqual([71, 379, 311, 315, 21, 310]);
    expect(g("runner-left")).toEqual([58, 69, 373, 387, 28, 295]);        // 滑條 11 寬 × 14 高，後端收在抽屜後板正面

    expect(part("top-core").material).toBe("blockboard-primary");
    expect(part("side-panel-left").material).toBe("blockboard-primary");
    expect(part("rail-front").material).toBe("pine");                     // 下橫桿是實木
  });

  it("⭐ 每支榫頭都要真的配到榫眼（位置＋軸向，不是只比尺寸）", () => {
    // 🩸 2026-09-09：腳的榫眼 origin.y 用了 from-top（正確是 from-bottom），四支腳的孔全部差 145~350mm；
    //    上橫檔的榫 width/thickness 對調，榫頭比自己的料還寬 6mm/邊。
    //    測試 9 條全綠、auditJoints 0/0、npm run audit exit 0 —— 三道閘都沒攔，因為它們只比尺寸不比位置。
    const idx = buildWorldMortiseIndex(d.parts);
    const unfit: string[] = [];
    for (const p of d.parts) for (const t of p.tenons) {
      if (!matchMortiseForTenon(p, t, tenonWorld(p, t), idx)) unfit.push(`${p.id}:${t.position}`);
    }
    expect(unfit, `這些榫頭找不到位置／軸向相符的榫眼：${unfit.join(", ")}`).toEqual([]);
  });

  it("⭐ 接合尺寸（榫頭斷面、木釘入料深、槽）——變異測試證明過這些以前全都沒被守住", () => {
    const t = (id: string) => part(id).tenons.map((x) => [x.width, x.thickness, x.length]);
    // 上橫檔：榫厚 12（A-A 腳斷面鏈 10｜12｜10＝32）× 榫高 44 × 榫長 20
    // width 沿 visible.width(32)、thickness 沿 visible.thickness(60) —— 對調就切不出來
    expect(t("top-rail-left")).toEqual([[12, 44, 20], [12, 44, 20]]);
    expect(10 + 12 + 10).toBe(32);
    // 下橫桿 visible = { width: 45(高), thickness: 24(厚) } ⇒ 榫高 35 放 width、榫厚 10 放 thickness
    // （圖上 7｜10｜7＝24 是厚度方向的鏈）
    expect(t("rail-front")).toEqual([[35, 10, 20], [35, 10, 20]]);
    expect(7 + 10 + 7).toBe(24);
    // 榫頭斷面不可以比自己的料還大
    for (const p of d.parts) for (const x of p.tenons) {
      expect(x.width, `${p.id} 榫寬 ${x.width} > 料寬 ${p.visible.width}`).toBeLessThanOrEqual(p.visible.width);
      expect(x.thickness, `${p.id} 榫厚 ${x.thickness} > 料厚 ${p.visible.thickness}`).toBeLessThanOrEqual(p.visible.thickness);
    }
    // 木釘孔：入被面接的那件 12、入端面那件 18（B-B「12｜18」＝30）；孔徑一律 Ø8
    const holes = d.parts.flatMap((p) => p.mortises.filter((m) => m.shape === "round").map((m) => [m.depth, m.length, m.width]));
    expect(holes).toHaveLength(42);                                   // 21 支木釘 × 2 個孔
    expect([...new Set(holes.map((h) => h[0]))].sort((a, b) => a - b), "孔深只有 12 與 18").toEqual([12, 18]);
    expect([...new Set(holes.flatMap((h) => [h[1], h[2]]))], "孔徑一律 Ø8").toEqual([8]);
    expect(holes.filter((h) => h[0] === 12)).toHaveLength(21);
    expect(holes.filter((h) => h[0] === 18)).toHaveLength(21);
    // 槽：滑條槽 15 高 × 7 深、底板槽 4 寬 × 5 深
    const slot = part("drawer-1-side-left").mortises.find((m) => (m.label ?? "").includes("滑條"))!;
    expect([slot.width, slot.depth]).toEqual([15, 7]);
    for (const id of ["drawer-1-front", "drawer-1-side-left", "drawer-1-side-right"]) {
      const g = part(id).mortises.find((m) => (m.label ?? "").includes("底板槽"))!;
      expect([g.width, g.depth], id).toEqual([4, 7]);
    }
    // 滑條 11×14 入槽 6 留 1（槽 7 深）
    expect([part("runner-left").visible.width, part("runner-left").visible.thickness]).toEqual([14, 11]);
  });

  it("⭐ 非通孔的深度不可以超過料件在那個軸的厚度（＝不可以鑽穿）", () => {
    // 🩸 變異測試發現：`dowelIntoPanel` 12→25（在 18mm 木心板上鑽 25 深＝鑽穿桌面）
    //    全套 1776 條測試 ＋ npm run audit 全鏈都是綠的。這條把那個洞補上。
    const bad: string[] = [];
    for (const p of d.parts) for (const m of p.mortises) {
      if (m.through) continue;
      const box = mortiseLocalBox(p, m);
      const host = { x: p.visible.length, y: p.visible.thickness, z: p.visible.width }[box.depthAxis ?? "y"];
      if (m.depth > host + 0.01) bad.push(`${p.id} ${m.label ?? ""} 深 ${m.depth} > ${box.depthAxis} 軸料厚 ${host}`);
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("0 穿模（含各選項）、榫接 0 落單、組裝順序算得出來", () => {
    const opts: Array<Record<string, string | number | boolean>> = [{}, { withDrawer: false }, { drawerPull: 60 }, { drawerPull: 250 }];
    for (const o of opts) {
      expect(findOverlaps(build(o).parts), JSON.stringify(o)).toEqual([]);
    }
    const a = auditJoints(d);
    expect([a.unmatchedTenons.length, a.unmatchedMortises.length]).toEqual([0, 0]);
    expect(planAssembly(d).steps.length).toBeGreaterThan(10);
  });

  it("尺寸鎖死：滑桿不作用、會出聲，考題尺寸不噴警告", () => {
    expect(build().warnings ?? [], "考題預設尺寸不該有任何警告").toEqual([]);
    for (const size of [{ length: 300, width: 300, height: 300 }, { length: 800, width: 800, height: 800 }]) {
      const x = build({}, size);
      expect(x.overall).toEqual({ length: 450, width: 360, thickness: 450 });
      expect(x.warnings?.some((w) => w.includes("固定")), "夾了要出聲").toBe(true);
      expect(findOverlaps(x.parts)).toEqual([]);
    }
    expect(build({ withDrawer: false }).parts.some((p) => p.id.startsWith("drawer-"))).toBe(false);
    const pulled = build({ drawerPull: 120 });
    expect(r1(worldAABB(pulled.parts.find((p) => p.id === "drawer-1-front")!).min.z + 180)).toBe(-110);
    expect(r1(worldAABB(pulled.parts.find((p) => p.id === "rail-front")!).min.z + 180)).toBe(51.1);
  });
});
