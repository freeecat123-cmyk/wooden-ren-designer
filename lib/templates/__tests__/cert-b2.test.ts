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
    expect(part("rail-front").tenons.map((t) => [t.position, t.thickness, t.width])).toEqual([["start", 12, 30], ["end", 12, 30]]);
    expect(part("rail-mid-left").tenons.map((t) => [t.position, t.thickness, t.width])).toEqual([["start", 10, 10], ["end", 10, 10]]);
    expect(part("rail-mid-left").tenons.every((t) => t.shoulderOn?.length === 4), "榫接密合 32＝4 支 × 2 端 × 4 面肩").toBe(true);
  });

  it("抽屜外 408×320：前板 130 高頂離天板底 2、正面比腳前面縮 15；側板 110 高；後板 90 高；4mm 合板底板", () => {
    expect(g("drawer-1-front")).toEqual([37, 445, 260, 390, 15, 33]);    // 408 寬＝418−2×5；390＝392−2
    const s = g("drawer-1-side-left");
    expect([s[0], s[1], s[2], s[3]]).toEqual([37, 52, 272, 382]);
    expect(r1(35 + 300)).toBe(335);                                      // 抽屜外深 320 ＝ 前面 15 → 後板背面 335
    expect(s[5]).toBe(335);
    expect(g("drawer-1-back")).toEqual([52, 430, 287.5, 377.5, 320, 335]);
    const bt = g("drawer-1-bottom");
    expect([bt[2], bt[3]]).toEqual([283.5, 287.5]);                      // 4 厚、頂與後板底齊
    // 半隱鳩尾：18 厚前板留 6 面皮 → 榫孔深 12、側板前端在 z=21
    const dt = part("drawer-1-side-left").shape!;
    expect([dt.kind, (dt as { pinDepth: number }).pinDepth, (dt as { segmentCount: number }).segmentCount]).toEqual(["dovetail-ends", 12, 7]);
    expect(s[4]).toBe(21);
  });

  it("滑條 12 寬 × 14 高，槽 15 高 8 深、槽頂離地 327.5，滑條入槽 7 留 1 間隙", () => {
    expect(g("runner-left")).toEqual([32, 44, 313.5, 327.5, 45, 355]);   // 12 寬：32~44；14 高
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
    const tiny = build({}, { length: 100, width: 100, height: 100 });
    expect(tiny.overall).toEqual({ length: 482, width: 400, thickness: 300 });
    expect(tiny.warnings?.some((w) => w.includes("夾到"))).toBe(true);
    expect(findOverlaps(tiny.parts)).toEqual([]);
    expect(build({}, { length: 600, width: 400, height: 420 }).warnings?.some((w) => w.includes("不是考題尺寸"))).toBe(true);
  });
});
