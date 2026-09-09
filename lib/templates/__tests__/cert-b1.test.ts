/**
 * 乙級第一題 cert-b1：官方數字逐項（PDF 第 15 頁工作圖 × 第 7 頁評審表）、木釘 25 支、榫眼開口面、0 穿模、組裝順序。
 */
import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { findOverlaps, worldAABB } from "@/lib/geometry/overlap";
import { buildWorldMortiseIndex } from "@/lib/assembly/joint-world";
import { planAssembly } from "@/lib/assembly/plan";
import { certB1FrontProfile } from "@/lib/templates/cert-b1";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-b1")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-b1 評審表尺寸", () => {
  const d = build();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  const box = (id: string) => worldAABB(part(id));
  it("總高／桌面 450×450、腳架 410×410、腳柱 45×32", () => {
    expect(d.overall).toEqual({ length: 450, width: 450, thickness: 450 });
    const top = box("top-core"), fe = box("top-edge-front"), le = box("top-edge-left");
    expect([top.min.x, top.max.x, top.min.y, top.max.y]).toEqual([-217, 217, 432, 450]);
    expect([fe.min.x, fe.max.x, fe.min.z, fe.max.z]).toEqual([-225, 225, -225, -217]);   // 8mm 封邊
    expect([le.min.x, le.max.x, le.min.z, le.max.z]).toEqual([-225, -217, -217, 217]);
    const lf = box("leg-left-front"), rb = box("leg-right-back");
    expect([lf.min.x, lf.max.x, lf.min.z, lf.max.z, lf.min.y, lf.max.y]).toEqual([-205, -173, -205, -160, 0, 432]);
    expect([rb.min.x, rb.max.x, rb.min.z, rb.max.z]).toEqual([173, 205, 160, 205]);
  });
  it("側板／後板 105 高木心板：側板外面離腳外面 9（內面離腳內面 5）、後板背面離腳背面 10", () => {
    const s = box("side-rail-left"), b = box("back-rail");
    expect([s.min.x, s.max.x, s.min.y, s.max.y, s.min.z, s.max.z]).toEqual([-196, -178, 327, 432, -160, 160]);
    expect([b.min.z, b.max.z, b.min.y, b.max.y, b.min.x, b.max.x]).toEqual([177, 195, 327, 432, -173, 173]);
    expect(part("side-rail-left").material).toBe("blockboard-primary");
    expect(part("back-rail").material).toBe("blockboard-primary");
  });
  it("前曲線橫檔 60 高：頂在桌面下 125、底 185，正面離腳正面 10，6 厚榫入腳 21、上下各 4 肩", () => {
    const f = box("front-rail");
    expect([f.min.y, f.max.y, f.min.z, f.max.z, f.min.x, f.max.x]).toEqual([265, 325, -195, -177, -173, 173]);
    const t = part("front-rail").tenons;
    expect(t.map((x) => [x.position, x.length, x.width, x.thickness])).toEqual([["start", 21, 52, 6], ["end", 21, 52, 6]]);
    // 腳上的榫眼：開在內側 x 面、中心在橫檔中心高 295、z −186
    const idx = buildWorldMortiseIndex(d.parts).filter((m) => m.partId === "leg-left-front" && m.depth === 21 && m.axis === "x");
    expect(idx.map((m) => [m.entryX, m.entryY, m.entryZ])).toEqual([[-173, 295, -186]]);
  });
  it("壸門：兩端 70 平段，R15/R15 相切升高 20（θ=acos(1−20/30)）", () => {
    const pts = certB1FrontProfile();
    expect(pts[1]).toEqual([-103, 30]);                        // 平段終點 = −173 + 70
    const ys = pts.map((p) => p[1]);
    expect(r1(Math.min(...ys.filter((_, i) => i < pts.length / 2)))).toBe(10);   // 底緣最高點升 20 → z = 30 − 20
    const theta = Math.acos(1 - 20 / 30);
    const leftHalf = pts.slice(0, Math.floor(pts.length / 2)).filter((p) => p[0] < 0);
    const curveEnd = leftHalf.find((p) => Math.abs(p[1] - 10) < 1e-9)!;
    expect(r1(curveEnd[0])).toBe(r1(-103 + 2 * 15 * Math.sin(theta)));   // 兩弧水平跨 2r·sinθ ＝ 28.3
  });
  it("抽屜 340×350：面板 103×18 頂離桌面底 2、側板 15×100 頂離桌面底 5、後板 80、底板 4 合板 324×339", () => {
    const f = box("drawer-1-front"), s = box("drawer-1-side-left"), b = box("drawer-1-back"), bt = box("drawer-1-bottom");
    expect([f.min.x, f.max.x, f.min.y, f.max.y, f.min.z, f.max.z]).toEqual([-170, 170, 327, 430, -195, -177]);
    expect([s.min.x, s.max.x, s.min.y, s.max.y]).toEqual([-170, -155, 327, 427]);
    expect(r1(s.max.z - (-195))).toBe(350);                    // 外深 350
    // 面板端半隱鳩尾：榫孔深 12、面皮 6（C-C 面板剖面的虛線離正面 6）→ 側板 −189..155、長 344
    expect([s.min.z, s.max.z, r1(s.max.z - s.min.z)]).toEqual([-189, 155, 344]);
    const dt = part("drawer-1-side-left").shape!;
    expect(dt.kind).toBe("dovetail-ends");
    expect([(dt as { segmentCount: number }).segmentCount, (dt as { pinDepth: number }).pinDepth]).toEqual([7, 12]);
    expect([b.min.y, b.max.y, b.min.z, b.max.z]).toEqual([342, 422, 140, 155]);
    expect([bt.min.x, bt.max.x, r1(bt.max.z - bt.min.z), bt.min.y, bt.max.y]).toEqual([-162, 162, 339, 338, 342]);
    const hole = part("drawer-1-front").mortises.find((m) => m.shape === "round")!;
    expect([hole.length, hole.through, hole.origin.x, hole.origin.z]).toEqual([20, true, 0, 0]);   // 正中央 Ø20
  });
  it("滑條 15×14×320 鎖在側板內面，頂在桌面下 45；抽屜側板槽 15 高 8 深、底板槽 4×7 槽頂離底 15", () => {
    const r = box("runner-left");
    expect([r.min.x, r.max.x, r.min.y, r.max.y, r.min.z, r.max.z]).toEqual([-178, -163, 373, 387, -160, 160]);
    const idx = buildWorldMortiseIndex(d.parts).filter((m) => m.partId === "drawer-1-side-left");
    const groove = idx.find((m) => m.depth === 8 && m.axis === "x")!, bottom = idx.find((m) => m.depth === 7 && m.axis === "x")!;
    expect([groove.entryX, groove.entryY]).toEqual([-170, 379.5]);   // 外面、槽中心 = 387 − 7.5（槽頂離桌面底 45）
    expect([bottom.entryX, bottom.entryY]).toEqual([-155, 340]);     // 內面、槽 338–342 → 頂離底 15
  });
  it("木釘 25 支 Ø8×30：桌面 13（腳 4＋每板 3，離腳內面 31/173/315）、側板端 8、後板端 4；入桌面 12、入腳 15", () => {
    const dowels = d.parts.filter((p) => p.visual === "dowel");
    expect(dowels).toHaveLength(25);
    const top = dowels.filter((p) => p.id.startsWith("dowel-top-")).map((p) => worldAABB(p));
    expect(top).toHaveLength(13);
    for (const b of top) expect([b.min.y, b.max.y]).toEqual([414, 444]);
    // 側板那三支沿深度走，腳沿深度是 45 → 離腳內面 18／160／302，世界 −142／0／+142（跟後板同位）
    const sideZ = top.filter((b) => Math.abs((b.min.x + b.max.x) / 2) === 187).map((b) => (b.min.z + b.max.z) / 2).sort((a, b) => a - b);
    expect(sideZ).toEqual([-142, -142, 0, 0, 142, 142]);
    const backX = top.filter((b) => Math.abs((b.min.z + b.max.z) / 2 - 186) < 1).map((b) => (b.min.x + b.max.x) / 2).sort((a, b) => a - b);
    expect(backX).toEqual([-142, 0, 142]);                      // −173 + 31 / 173 / 315
    // 板端入腳木釘：入腳 15（B-B 的 15｜15，兩段加起來＝木釘全長 30）
    const legHole = buildWorldMortiseIndex(d.parts).find((m) => m.partId === "leg-left-front" && m.axis === "z" && m.depth === 15);
    expect(legHole, "腳上要有深 15 的側板木釘孔").toBeDefined();
    const side = dowels.filter((p) => p.id.startsWith("dowel-side-")).map((p) => worldAABB(p));
    expect(side).toHaveLength(8);
    expect(side.map((b) => [b.min.z, b.max.z]).every(([a, b]) => Math.abs(a) === 145 && Math.abs(b) === 175 || Math.abs(a) === 175 && Math.abs(b) === 145)).toBe(true);
    expect(dowels.filter((p) => p.id.startsWith("dowel-back-"))).toHaveLength(4);
  });
  it("0 穿模（多組尺寸）、組裝順序算得出來", () => {
    expect(findOverlaps(d.parts)).toEqual([]);
    // 只在預設尺寸驗一次會漏掉「抽屜與木釘列不跟著跨距縮」那類錯（程式審查員 2026-09-09）
    for (const size of [{ length: 450, width: 450, height: 300 }, { length: 600, width: 450, height: 450 },
                        { length: 450, width: 600, height: 600 }, { length: 800, width: 800, height: 800 }]) {
      expect(findOverlaps(build({}, size).parts), `${size.length}×${size.width}×${size.height}`).toEqual([]);
    }
    const plan = planAssembly(d);
    expect(plan.steps.length).toBeGreaterThan(5);
  });
  it("不裝抽屜就沒有抽屜件；拉出示意只動抽屜", () => {
    const noDrawer = build({ withDrawer: false });
    expect(noDrawer.parts.some((p) => p.id.startsWith("drawer-"))).toBe(false);
    const pulled = build({ drawerPull: 100 });
    expect(worldAABB(pulled.parts.find((p) => p.id === "drawer-1-front")!).min.z).toBe(-295);
    expect(worldAABB(pulled.parts.find((p) => p.id === "front-rail")!).min.z).toBe(-195);
  });
  it("非考題尺寸出聲；太小夾住", () => {
    expect(build({}, { length: 500, width: 450, height: 450 }).warnings?.some((w) => w.includes("不是考題尺寸"))).toBe(true);
    // 長寬夾在考題尺寸 450（低於它抽屜就塞不進兩支腳、桌面木釘會跑到料外）；高度下限 300
    const tiny = build({}, { length: 100, width: 100, height: 100 });
    expect(tiny.overall).toEqual({ length: 450, width: 450, thickness: 300 });
    expect(tiny.warnings?.some((w) => w.includes("夾到"))).toBe(true);
    expect(findOverlaps(tiny.parts)).toEqual([]);
  });
});
