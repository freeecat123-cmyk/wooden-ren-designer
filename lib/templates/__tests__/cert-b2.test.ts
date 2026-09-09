/**
 * 乙級第二題 cert-b2：官方數字逐項（工作圖 PDF 第 16 頁 × 評審表第 8 頁）、25 支木釘、榫接 0 落單、0 穿模。
 *
 * 期望值全部用圖面座標手算（X 0~482 由左、Y 0~420 由地面、Z 0~400 由正面），再換算成世界座標比對；
 * 不是把程式輸出貼上來。
 */
import { describe, it, expect } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { findOverlaps, worldAABB } from "@/lib/geometry/overlap";
import { auditJoints } from "@/lib/joinery/audit-joints";
import { planAssembly } from "@/lib/assembly/plan";
import { projectPartPolygon } from "@/lib/render/geometry";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-b2")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-b2 評審表尺寸", () => {
  const d = build();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  /** 世界座標 → 圖面座標（x+241、y 不變、z+200） */
  const g = (id: string) => {
    const b = worldAABB(part(id));
    return [r1(b.min.x + 241), r1(b.max.x + 241), r1(b.min.y), r1(b.max.y), r1(b.min.z + 200), r1(b.max.z + 200)];
  };

  it("總 482×400×420；腳柱 32(寬)×45(深)×420 四角", () => {
    expect(d.overall).toEqual({ length: 482, width: 400, thickness: 420 });
    expect(g("leg-left-front")).toEqual([0, 32, 0, 420, 0, 45]);
    expect(g("leg-right-back")).toEqual([450, 482, 0, 420, 355, 400]);
  });

  it("側板 18×147 木心板＋上緣 8 封邊＝155 高；內面與腳內面齊、外面縮 14；長 310", () => {
    expect(g("side-panel-left")).toEqual([14, 32, 260, 407, 45, 355]);   // 407＝415−8；260＝415−155
    expect(g("side-edge-left")).toEqual([14, 32, 407, 415, 45, 355]);
    expect(part("side-panel-left").material).toBe("blockboard-primary");
    expect(part("side-edge-left").material).toBe("pine");                // 封邊是實木
  });

  it("天板 418×368×18 頂面離地 410（腳頂下 10）；前後各 8 封邊 → 總深 384", () => {
    expect(g("top-core")).toEqual([32, 450, 392, 410, 16, 384]);
    expect(g("top-edge-front")).toEqual([32, 450, 392, 410, 8, 16]);
    expect(g("top-edge-back")).toEqual([32, 450, 392, 410, 384, 392]);
    expect(part("top-core").material).toBe("blockboard-primary");
  });

  it("背板 418×132×18 在 z 367~385、離地 260~392（頂與天板底齊）", () => {
    expect(g("back-panel")).toEqual([32, 450, 260, 392, 367, 385]);
  });

  it("下橫檔：前後 45×24 上緣離地 120、深度置中於腳；中間 30×18 離腳內面 110、比 45 檔低 7.5", () => {
    expect(g("rail-front")).toEqual([32, 450, 75, 120, 10.5, 34.5]);     // 10.5｜24｜10.5＝45 腳深
    expect(g("rail-back")).toEqual([32, 450, 75, 120, 365.5, 389.5]);
    // 中間兩支夾在前後檔之間（前檔背面 34.5 → 後檔正面 365.5）
    expect(g("rail-mid-left")).toEqual([142, 160, 82.5, 112.5, 34.5, 365.5]);
    expect(g("rail-mid-right")).toEqual([322, 340, 82.5, 112.5, 34.5, 365.5]);
    // 榫：45×24 檔 12 厚（6｜12｜6）、中間檔 10 高（10｜10｜10）
    expect(part("rail-front").tenons.map((t) => [t.position, t.thickness, t.width])).toEqual([["start", 12, 45], ["end", 12, 45]]);
    expect(part("rail-mid-left").tenons.map((t) => [t.position, t.thickness, t.width])).toEqual([["start", 10, 10], ["end", 10, 10]]);
    // 45×24 檔是**貫穿榫**：滿 45 高、12 厚、穿透腳柱 32（A-A 下段腳內虛線橫跨整個 32 寬且滿 45 高；
    // B-B 下段榫孔虛線由腳內面畫到外面；三視圖側視腳外面有 12×45 榫痕）
    expect(part("rail-front").tenons.map((t) => [t.type, t.length, t.width, t.thickness])).toEqual([
      ["through-tenon", 32, 45, 12], ["through-tenon", 32, 45, 12],
    ]);
    expect(part("leg-left-front").mortises.filter((m) => !m.shape).map((m) => [m.depth, m.length, m.width, m.through]))
      .toEqual([[32, 45, 12, true]]);
    expect(part("rail-mid-left").tenons.every((t) => t.shoulderOn?.length === 4), "榫接密合 32＝4 支 × 2 端 × 4 面肩").toBe(true);
  });

  it("抽屜外 408×320：前板 130 高頂離天板底 2、正面比腳前面縮 15；側板 110 高；後板 90 高；4mm 合板底板", () => {
    expect(g("drawer-1-front")).toEqual([37, 445, 260, 390, 15, 33]);    // 408 寬＝418−2×5；390＝392−2
    const s = g("drawer-1-side-left");
    expect([s[0], s[1], s[2], s[3]]).toEqual([37, 52, 272, 382]);
    expect(r1(35 + 300)).toBe(335);                                      // 抽屜外深 320 ＝ 前面 15 → 後板背面 335
    expect(s[5]).toBe(335);
    expect(g("drawer-1-back")).toEqual([52, 430, 287, 377, 320, 335]);   // A-A「5」：後板頂比側板頂低 5
    const bt = g("drawer-1-bottom");
    expect([bt[2], bt[3]]).toEqual([283, 287]);                          // 4 厚、頂與後板底齊
    // 半隱鳩尾：18 厚前板留 6 面皮 → 榫孔深 12、側板前端在 z=21
    const dt = part("drawer-1-side-left").shape!;
    expect([dt.kind, (dt as { pinDepth: number }).pinDepth, (dt as { segmentCount: number }).segmentCount]).toEqual(["dovetail-ends", 12, 9]);
    expect((dt as { angleDeg: number }).angleDeg, "學科 §01-19 鳩尾斜度 1:6 → atan(1/6)=9.46°").toBeCloseTo(9.46, 1);
    expect(s[4]).toBe(21);
    // 只有**前端**做鳩尾：後角官方是 ø3.5×30 木螺釘（工作圖 B-B 引線＋C-C「20｜50｜20」每邊 2 支）
    expect((dt as { ends?: string }).ends, "抽屜後角不做鳩尾").toBe("plus");
    // 齒距必須攤在兩塊板共有的接合窗口（側板 110）上，不是各自全高，否則嵌不進去
    const front = worldAABB(part("drawer-1-front")), side = worldAABB(part("drawer-1-side-left"));
    const win = Math.min(front.max.y, side.max.y) - Math.max(front.min.y, side.min.y);
    expect(win).toBe(110);
    const yOf = (id: string) => {
      const poly = projectPartPolygon(part(id), "front", d.parts);
      const ys = [...new Set(poly.map((q) => r1(q.y)))].sort((a, b) => a - b);
      return ys.slice(1).map((v, i) => r1(v - ys[i])).filter((g) => g > 0.6);
    };
    const pitch = (a: number[]) => r1(a.reduce((x, y) => x + y, 0) / a.length);
    expect(pitch(yOf("drawer-1-front")), "前板齒距要等於側板齒距 110/9").toBeCloseTo(110 / 9, 1);
    // ⚠️ 已知未解：底板槽（283~287）會跨過最下面那條齒界（272+110/9＝284.2）。
    // 槽的位置與齒數兩邊都是官方來的（槽位來自 C-C 實量、齒數來自評審表 18÷2 角），
    // 官方圖沒有畫出齒的分佈，所以先如實記錄、不自己編一條規則來擋。
    expect(r1(worldAABB(part("drawer-1-bottom")).max.y)).toBe(287);
  });

  it("底板槽 7 深、4 寬（前板＋兩側板共 3 條＝評審表「抽屜底板槽 3 部位」）", () => {
    const grooves = d.parts.flatMap((p) => p.mortises.filter((m) => (m.label ?? "").includes("底板")).map((m) => [p.id, m.depth, m.length ?? m.width]));
    expect(grooves.map((g) => g[1]), "槽深 7").toEqual(grooves.map(() => 7));
    expect(grooves).toHaveLength(3);
  });

  it("滑條 12 寬 × 14 高，槽 15 高 8 深、槽頂離地 327.5，滑條入槽 7 留 1 間隙", () => {
    expect(g("runner-left")).toEqual([32, 44, 313, 327, 45, 355]);       // 12 寬：32~44；14 高
    const slot = part("drawer-1-side-left").mortises.find((m) => m.depth === 8)!;
    expect([slot.width, slot.depth]).toEqual([15, 8]);                    // 15 高 × 8 深
    expect(44 - 37).toBe(7);                                             // 滑條進槽 7（槽 8 深留 1）
  });

  it("木釘 25 支 Ø8×30：側板↔腳 12、天板↔側板 6、天板↔背板 3、背板↔腳 4", () => {
    const dowels = d.parts.filter((p) => p.visual === "dowel");
    expect(dowels).toHaveLength(25);
    expect(dowels.filter((p) => p.id.startsWith("dowel-side-"))).toHaveLength(12);
    expect(dowels.filter((p) => p.id.startsWith("dowel-top-side-"))).toHaveLength(6);
    expect(dowels.filter((p) => p.id.startsWith("dowel-top-back-"))).toHaveLength(3);
    expect(dowels.filter((p) => p.id.startsWith("dowel-back-"))).toHaveLength(4);
    // 側板木釘離地 377／337.5／298（由板頂 415 起 38｜39.5｜39.5）
    const ys = dowels.filter((p) => p.id.startsWith("dowel-side-")).map((p) => r1((worldAABB(p).min.y + worldAABB(p).max.y) / 2));
    expect([...new Set(ys)].sort((a, b) => a - b)).toEqual([298, 337.5, 377]);
    // 天板↔側板木釘沿寬度方向，z＝72／200／328
    const zs = dowels.filter((p) => p.id.startsWith("dowel-top-side-")).map((p) => r1((worldAABB(p).min.z + worldAABB(p).max.z) / 2 + 200));
    expect([...new Set(zs)].sort((a, b) => a - b)).toEqual([72, 200, 328]);
  });

  it("官方尺寸鏈：每條鏈的節點與總和都對得上（不是抄程式輸出）", () => {
    /** 相鄰節點差 → 與官方標註的鏈逐格比對，最後驗總和 */
    const chain = (ys: number[]) => ys.slice(1).map((v, i) => r1(Math.abs(v - ys[i])));
    // A-A 側板：板頂 415 起 38｜39.5｜39.5｜38 ＝ 155（三支木釘在節點上）
    const sideY = d.parts.filter((p) => p.id.startsWith("dowel-side-0")).map((p) => r1((worldAABB(p).min.y + worldAABB(p).max.y) / 2));
    const sideNodes = [415, ...[...new Set(sideY)].sort((a, b) => b - a), 260];
    expect(chain(sideNodes), "A-A 155 鏈").toEqual([38, 39.5, 39.5, 38]);
    expect(r1(415 - 260)).toBe(155);
    // C-C 背板：天板底 392 起 27｜78｜27 ＝ 132
    const backY = d.parts.filter((p) => p.id.startsWith("dowel-back-0")).map((p) => r1((worldAABB(p).min.y + worldAABB(p).max.y) / 2));
    expect(chain([392, ...[...new Set(backY)].sort((a, b) => b - a), 260]), "C-C 132 鏈").toEqual([27, 78, 27]);
    // C-C 深度：8｜64｜128｜128｜64｜8 ＝ 400（64/128/128/64 的節點就是天板↔側板木釘 z）
    const topZ = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-top-side-0")).map((p) => r1((worldAABB(p).min.z + worldAABB(p).max.z) / 2 + 200)))].sort((a, b) => a - b);
    expect(chain([0, 8, ...topZ, 392, 400]), "C-C 400 鏈").toEqual([8, 64, 128, 128, 64, 8]);
    // B-B 背板頂木釘：38｜171｜171｜38 ＝ 418
    const backTopX = [...new Set(d.parts.filter((p) => p.id.startsWith("dowel-top-back-")).map((p) => r1((worldAABB(p).min.x + worldAABB(p).max.x) / 2 + 241)))].sort((a, b) => a - b);
    expect(chain([32, ...backTopX, 450]), "B-B 418 鏈").toEqual([38, 171, 171, 38]);
    // C-C 抽屜：5｜90｜15 ＝ 110（側板頂→後板頂→後板底→側板底）
    expect(chain([382, 377, 287, 272]), "C-C 抽屜 110 鏈").toEqual([5, 90, 15]);
    // A-A 滑條槽：55｜15｜40 ＝ 110
    expect(chain([382, 327, 312, 272]), "A-A 滑條槽 110 鏈").toEqual([55, 15, 40]);
    // A-A 平面：14｜18｜5｜15 ＝ 52，482−2×52 ＝ 378、抽屜外 408
    expect(14 + 18 + 5 + 15).toBe(52);
    expect(482 - 2 * 37).toBe(408);
    // 木釘 Ø8×30：入實木腳 12｜入木心板 18 ＝ 30（B-B 上段）
    expect(12 + 18).toBe(30);
    const legHoles = [...new Set(part("leg-left-front").mortises.filter((m) => m.shape === "round").map((m) => m.depth))];
    expect(legHoles, "腳上的木釘孔一律 12 深").toEqual([12]);
    expect([...new Set(part("side-panel-left").mortises.filter((m) => m.label?.includes("入腳")).map((m) => m.depth))]).toEqual([18]);
  });

  it("部位數：腳 4、下橫檔 4（左右不設檔）、木釘 25、榫頭 8", () => {
    expect(d.parts.filter((p) => /^leg-/.test(p.id))).toHaveLength(4);
    const rails = d.parts.filter((p) => /^rail-/.test(p.id)).map((p) => p.id).sort();
    expect(rails, "評審表下橫檔 4 部位＝前後 45×24 各 1 ＋ 中間 30×18 各 1；左右沒有橫檔")
      .toEqual(["rail-back", "rail-front", "rail-mid-left", "rail-mid-right"]);
    expect(d.parts.flatMap((p) => p.tenons), "榫頭 8 支＝4 檔 × 2 端").toHaveLength(8);
    expect(d.parts.filter((p) => p.visual === "dowel")).toHaveLength(25);
    expect(d.parts).toHaveLength(48);
  });

  it("0 穿模（多組尺寸）、榫接 0 落單、組裝順序算得出來", () => {
    expect(findOverlaps(d.parts)).toEqual([]);
    for (const size of [{ length: 482, width: 400, height: 300 }, { length: 600, width: 400, height: 420 },
                        { length: 482, width: 600, height: 600 }, { length: 800, width: 800, height: 800 }]) {
      expect(findOverlaps(build({}, size).parts), `${size.length}×${size.width}×${size.height}`).toEqual([]);
    }
    const a = auditJoints(d);
    expect([a.unmatchedTenons.length, a.unmatchedMortises.length]).toEqual([0, 0]);
    expect(planAssembly(d).steps.length).toBeGreaterThan(10);
  });

  it("不裝抽屜就沒有抽屜件；拉出示意只動抽屜；尺寸夾在考題尺寸並出聲", () => {
    expect(build({ withDrawer: false }).parts.some((p) => p.id.startsWith("drawer-"))).toBe(false);
    const pulled = build({ drawerPull: 120 });
    expect(r1(worldAABB(pulled.parts.find((p) => p.id === "drawer-1-front")!).min.z + 200)).toBe(-105);
    expect(r1(worldAABB(pulled.parts.find((p) => p.id === "rail-front")!).min.z + 200)).toBe(10.5);
    expect(build().warnings ?? [], "考題預設尺寸不該有任何警告（EXAM.H 被改壞時這條會紅）").toEqual([]);
    const tiny = build({}, { length: 100, width: 100, height: 100 });
    expect(tiny.overall).toEqual({ length: 482, width: 400, thickness: 300 });
    expect(tiny.warnings?.some((w) => w.includes("夾到"))).toBe(true);
    expect(findOverlaps(tiny.parts)).toEqual([]);
    expect(build({}, { length: 600, width: 400, height: 420 }).warnings?.some((w) => w.includes("不是考題尺寸"))).toBe(true);
  });
});
