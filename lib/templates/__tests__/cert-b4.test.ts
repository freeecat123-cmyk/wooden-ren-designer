/**
 * 乙級第四題 cert-b4：官方數字逐項（工作圖 PDF 第 18 頁 × 評審表第 10 頁 × 材料表）。
 *
 * ⭐ 期望值全部用**官方尺寸鏈**手算（X 0~472 由左腳柱外面、Y 0~370 由地面、Z 0~380 由正面），
 *    不是把程式輸出貼上來。座標類斷言只證明「程式照 EXAM 算對了」，抓不到「EXAM 讀錯圖」——
 *    真正抓得到的是**尺寸鏈斷言**（鏈的節點與總和都是官方標的）與**部位數斷言**。
 *
 * ⚠️ 本題建模時被工作圖推翻過四個先入為主，四條都在下面釘死，改壞會紅：
 *    ① 抽屜前板 384（不是 394，它是抽屜箱的一員、做半隱鳩尾）
 *    ② 抽屜後板 82（不是 102，102 是側板）
 *    ③ 滑軌槽深 7（不是 7.5）
 *    ④ 前板底緣背面有 140×12×6 手掛槽
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { findOverlaps, worldAABB } from "@/lib/geometry/overlap";
import { auditJoints } from "@/lib/joinery/audit-joints";
import { planAssembly } from "@/lib/assembly/plan";
import { buildWorldMortiseIndex, matchMortiseForTenon, tenonWorld } from "@/lib/assembly/joint-world";
import { CompactThreeViews, mortiseLocalBox } from "@/lib/render/svg-views";
import { projectPartSilhouette } from "@/lib/render/geometry";
import { deriveBuildSteps } from "@/lib/steps/derive";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-b4")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-b4 官方尺寸", () => {
  const d = build();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  /** 世界座標 → 圖面座標（x+236、y 不變、z+190） */
  const g = (id: string) => {
    const b = worldAABB(part(id));
    return [b.min.x + 236, b.max.x + 236, b.min.y, b.max.y, b.min.z + 190, b.max.z + 190].map(r1);
  };

  it("評審表尺寸：總高 370／總寬 472／總深 380／腳柱 90×21（4 部位＝2 支）／腳座 45×32", () => {
    // ⚠️ overall 取的是**真實包絡 483**：腳座 32 厚比腳柱 21 厚每側多 5.5
    expect(d.overall).toEqual({ length: 483, width: 380, thickness: 370 });
    // 評審表「總寬 472」量的是腳柱外對外
    expect(r1(g("leg-right")[1] - g("leg-left")[0]), "腳柱外對外 472").toBe(472);
    expect(r1(g("foot-right")[1] - g("foot-left")[0]), "腳座著地全寬 483").toBe(483);
    // 板腳 21 厚 × 90 深，Y 45~360（頂面比天板頂低 10）
    expect(g("leg-left")).toEqual([0, 21, 45, 360, 145, 235]);
    expect(g("leg-right").slice(0, 2)).toEqual([451, 472]);
    // 六題唯一的板腳題：實木腳只有 2 支
    expect(d.parts.filter((p) => p.id.startsWith("leg-"))).toHaveLength(2);
    // 腳座 380 長 × 45 高 × 32 厚，與腳柱同軸（每側多 5.5）
    expect(g("foot-left")).toEqual([-5.5, 26.5, 0, 45, 0, 380]);
    // 上、中橫檔各 60×21
    expect(r1(g("top-rail")[5] - g("top-rail")[4]), "上橫檔 60 深").toBe(60);
    expect(r1(g("top-rail")[3] - g("top-rail")[2]), "上橫檔 21 厚").toBe(21);
    expect(r1(g("mid-rail")[3] - g("mid-rail")[2]), "中橫檔 60 高").toBe(60);
    expect(r1(g("mid-rail")[5] - g("mid-rail")[4]), "中橫檔 21 厚").toBe(21);
  });

  it("寬度鏈 472＝21｜430｜21、430＝18｜394｜18、394＝5｜384｜5、384＝15｜354｜15", () => {
    expect([21, 430, 21].reduce((a, b) => a + b, 0)).toBe(472);
    expect([18, 394, 18].reduce((a, b) => a + b, 0)).toBe(430);
    expect([5, 384, 5].reduce((a, b) => a + b, 0)).toBe(394);
    expect([15, 354, 15].reduce((a, b) => a + b, 0)).toBe(384);
    // 節點：0｜21（腳）｜39（側板）｜44（抽屜外）｜59（抽屜內）… 對稱到 472
    expect(g("leg-left").slice(0, 2)).toEqual([0, 21]);
    expect(g("side-panel-left").slice(0, 2)).toEqual([21, 39]);
    expect(g("drawer-1-side-left").slice(0, 2)).toEqual([44, 59]);
    expect(g("drawer-1-side-right").slice(0, 2)).toEqual([413, 428]);
    expect(g("side-panel-right").slice(0, 2)).toEqual([433, 451]);
    // 抽屜箱外寬 384（評審表量的就是這個）
    expect(r1(g("drawer-1-side-right")[1] - g("drawer-1-side-left")[0])).toBe(384);
    // ⭐ 前板也是 384（嵌入式、兩端做半隱鳩尾），不是箱體開口 394
    expect(g("drawer-1-front").slice(0, 2), "抽屜前板 384 不是 394").toEqual([44, 428]);
    // 後板夾在兩側板之間 ＝ 354
    expect(g("drawer-1-back").slice(0, 2)).toEqual([59, 413]);
    // 天板／背板／上橫檔的跨距
    expect(g("top-core").slice(0, 2), "天板心材 430−2×8 封邊").toEqual([29, 443]);
    expect(g("back-panel").slice(0, 2), "背板 394 夾在兩側板之間").toEqual([39, 433]);
    expect(g("top-rail").slice(0, 2)).toEqual([39, 433]);
  });

  it("高度鏈 370＝18｜132｜60｜115｜45、箱體 150＝18｜2｜130、側板 102＝5｜82｜15", () => {
    expect([18, 132, 60, 115, 45].reduce((a, b) => a + b, 0)).toBe(370);
    expect([18, 2, 130].reduce((a, b) => a + b, 0)).toBe(150);
    expect([5, 82, 15].reduce((a, b) => a + b, 0)).toBe(102);
    expect([21, 40, 21].reduce((a, b) => a + b, 0)).toBe(82);
    expect([34, 64, 34].reduce((a, b) => a + b, 0)).toBe(132);
    // 由上往下：天板 352~370、箱內 220~352、中橫檔 160~220、空檔、腳座 0~45
    expect(g("top-core").slice(2, 4)).toEqual([352, 370]);
    expect(g("side-panel-left").slice(2, 4)).toEqual([220, 352]);
    expect(g("mid-rail").slice(2, 4)).toEqual([160, 220]);
    expect(g("foot-left").slice(2, 4)).toEqual([0, 45]);
    // 抽屜前板 130 高、頂縫 2
    expect(g("drawer-1-front").slice(2, 4)).toEqual([220, 350]);
    // ⭐ 側板 102 高（頂比前板低 3、比天板底低 5）；後板 82 高、坐在合板上
    expect(g("drawer-1-side-left").slice(2, 4), "抽屜側板 102").toEqual([245, 347]);
    expect(g("drawer-1-back").slice(2, 4), "抽屜後板 82 不是 102").toEqual([260, 342]);
    expect(r1(g("drawer-1-back")[3] - g("drawer-1-back")[2])).toBe(82);
    // 合板頂面 ＝ 後板底面（後板坐在底板上）
    expect(g("drawer-1-bottom")[3]).toBe(g("drawer-1-back")[2]);
    // 上橫檔 Y 220~241
    expect(g("top-rail").slice(2, 4)).toEqual([220, 241]);
  });

  it("深度鏈 380＝62｜128｜128｜62（天板木釘）＝145｜90｜145（腳柱）＝8｜364｜8（封邊）", () => {
    expect([62, 128, 128, 62].reduce((a, b) => a + b, 0)).toBe(380);
    expect([145, 90, 145].reduce((a, b) => a + b, 0)).toBe(380);
    expect([8, 364, 8].reduce((a, b) => a + b, 0)).toBe(380);
    expect([14, 32, 14].reduce((a, b) => a + b, 0)).toBe(60);
    expect(g("leg-left").slice(4, 6), "腳柱在腳座上 145｜90｜145").toEqual([145, 235]);
    expect(g("top-core").slice(4, 6), "天板心材 8｜364｜8").toEqual([8, 372]);
    expect(g("top-edge-front").slice(4, 6)).toEqual([0, 8]);
    expect(g("top-edge-back").slice(4, 6)).toEqual([372, 380]);
    // 抽屜外深 350（前板前面 Z3 退縮、後板後面 Z353）
    expect(g("drawer-1-front")[4], "前板比箱體前緣退縮 3").toBe(3);
    expect(r1(g("drawer-1-back")[5] - g("drawer-1-front")[4]), "抽屜外深 350").toBe(350);
    // 背板貼齊箱體後緣
    expect(g("back-panel").slice(4, 6)).toEqual([362, 380]);
    // 上橫檔緊貼前板背面
    expect(g("top-rail")[4]).toBe(g("drawer-1-front")[5]);
  });

  it("⭐ 腳座頂面 360（兩端各斜切 10）、中橫檔貫穿榫、腳柱榫 10 厚", () => {
    // 腳座是上窄下寬：底面 380、頂面 360（10｜360｜10）
    expect([10, 360, 10].reduce((a, b) => a + b, 0)).toBe(380);
    const foot = part("foot-left");
    expect(foot.shape?.kind).toBe("apron-trapezoid");
    const poly = projectPartSilhouette(foot, "side");
    const spanAt = (y: number) => {
      const zs: number[] = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if ((a.y - y) * (b.y - y) > 0) continue;
        const t = Math.abs(b.y - a.y) < 1e-9 ? 0 : (y - a.y) / (b.y - a.y);
        zs.push(a.x + t * (b.x - a.x));
      }
      return r1(Math.max(...zs) - Math.min(...zs));
    };
    // 斜切是線性的，取樣點要貼著兩端（y=1 時已經收了 20×1/45 ≈ 0.44）
    expect(spanAt(0.05), "腳座底面 380").toBeCloseTo(380, 0);
    expect(spanAt(44.95), "腳座頂面 360（兩端各斜切 10）").toBeCloseTo(360, 0);
    expect(spanAt(22.5), "斜切是直線不是弧").toBeCloseTo(370, 0);
    // 中橫檔兩端貫穿榫 10 厚 × 60 高 × 21 長（斷面 21＝5.5｜10｜5.5）
    expect([5.5, 10, 5.5].reduce((a, b) => a + b, 0)).toBe(21);
    const mid = part("mid-rail");
    expect(mid.tenons).toHaveLength(2);
    for (const t of mid.tenons) {
      expect([t.type, t.length, t.width, t.thickness]).toEqual(["through-tenon", 21, 60, 10]);
    }
    // 腳柱下端 10 厚 × 90 寬榫**貫穿**腳座（斷面 32＝11｜10｜11；榫長＝腳座全高 45）
    // 🩸 第一版寫成「官方未標、自訂盲榫 30」——圖上有：腳座立面與斷面兩處虛線都從頂面畫到底面、
    //    中間沒有封口線。盲榫一定要畫榫眼底。
    expect([11, 10, 11].reduce((a, b) => a + b, 0)).toBe(32);
    for (const id of ["leg-left", "leg-right"]) {
      expect(part(id).tenons).toHaveLength(1);
      const t = part(id).tenons[0];
      // position:"bottom" 的 width 走 local X（10 厚）、thickness 走 local Z（90 寬）
      expect([t.position, t.type, t.length, t.width, t.thickness]).toEqual(["bottom", "through-tenon", 45, 10, 90]);
    }
    for (const id of ["foot-left", "foot-right"]) {
      const m = part(id).mortises.find((x) => (x.label ?? "").includes("腳柱"))!;
      expect([m.depth, m.through], "腳座榫眼要穿透 45").toEqual([45, true]);
    }
  });

  it("⭐ 抽屜前板底緣背面的手掛槽 140×12×6（B-B 的 70 是半寬、C-C 的 6 是留厚）", () => {
    const front = part("drawer-1-front");
    const pull = front.mortises.find((m) => (m.label ?? "").includes("手掛"))!;
    expect(pull, "前板沒有手掛槽").toBeTruthy();
    expect([pull.depth, pull.length, pull.width]).toEqual([12, 140, 6]);
    expect(pull.cosmetic, "手掛槽是挖除不是榫眼").toBe(true);
    expect(pull.depth + 6, "18 ＝ 12 挖掉 ＋ 6 留厚").toBe(front.visible.thickness);
    // 位置：貼著前板底緣、開在背面
    const b = mortiseLocalBox(front, pull);
    expect(r1(b.cz + b.hz), "槽底貼齊前板底緣").toBe(r1(front.visible.width / 2));
    expect(r1(b.cy + b.hy), "槽開在背面").toBe(r1(front.visible.thickness / 2));
  });

  it("⭐ 部位數：木釘 21 支（12｜18）、木螺釘 12、底板槽 3 條、鳩尾 2 角", () => {
    const dowels = d.parts.filter((p) => p.visual === "dowel");
    expect(dowels, "圖上數得出來 21 支").toHaveLength(21);
    // 分組：天板↓側板 6、天板↓背板 3、背板↔側板 4、上橫檔↔側板 4、抽屜後板↔側板 4
    const count = (pre: string) => dowels.filter((p) => p.id.startsWith(pre)).length;
    expect([count("dowel-top-side-"), count("dowel-top-back-"), count("dowel-back-side-"),
      count("dowel-toprail-"), count("dowel-drawer-back-")]).toEqual([6, 3, 4, 4, 4]);
    expect(dowels.every((p) => p.visual === "dowel"), "木釘是現成品，不進裁切／零件圖").toBe(true);
    // 每支 Ø8×30，入面 12 ＋ 入端 18
    expect([12, 18].reduce((a, b) => a + b, 0)).toBe(30);
    for (const p of dowels) {
      const dims = [p.visible.length, p.visible.width, p.visible.thickness].sort((a, b) => a - b);
      expect(dims, p.id).toEqual([8, 8, 30]);
    }
    // 木釘孔：每組兩顆，深度只有 12 或 18
    const holes = d.parts.flatMap((p) => p.mortises.filter((m) => m.shape === "round" && !m.cosmetic));
    expect(holes).toHaveLength(42);
    expect([...new Set(holes.map((m) => m.depth))].sort((a, b) => a - b)).toEqual([12, 18]);
    expect([...new Set(holes.map((m) => m.length))]).toEqual([8]);
    // 木螺釘導引孔 13 個。⛔ 不是照評審表「12 部位」湊的——那是配分的分母不是支數
    //    （第一題「內部木釘 30 部位」＞ 材料表發的 29 支，硬反證）。
    // ⭐ Ø2.4×15 的 3 支是**材料表項次 10 釘死的**（只有抽屜底板會用到這個規格）。
    const pilots = d.parts.flatMap((p) => p.mortises.filter((m) => (m.label ?? "").includes("導引孔")));
    expect(pilots).toHaveLength(13);
    expect(pilots.filter((m) => (m.label ?? "").includes("Ø3.5×30")), "每側 2 支鎖板腳").toHaveLength(4);
    expect(pilots.filter((m) => (m.label ?? "").includes("Ø3×25")), "每側 3 支鎖滑軌").toHaveLength(6);
    expect(pilots.filter((m) => (m.label ?? "").includes("Ø2.4×15")), "材料表只發 3 支").toHaveLength(3);
    // 底板螺釘在抽屜內寬 354 上的位置：90｜87｜87｜90（圖上有中心記號、沒標尺寸）
    const bottomScrews = part("drawer-1-bottom").mortises.filter((m) => (m.label ?? "").includes("Ø2.4×15"));
    expect(bottomScrews.map((m) => r1(m.origin.x + 236)).sort((a, b) => a - b)).toEqual([149, 236, 323]);
    expect(pilots.every((m) => m.cosmetic && m.through), "導引孔要 cosmetic + 貫穿才畫得出來").toBe(true);
    // 抽屜底板槽 3 條（前板 ＋ 兩側板），槽深 7、槽寬 4
    const grooves = d.parts.flatMap((p) => p.mortises.filter((m) => (m.label ?? "").includes("底板槽")));
    expect(grooves, "六題都是 3 條").toHaveLength(3);
    expect(grooves.every((m) => m.depth === 7 && m.width === 4)).toBe(true);
    // ⭐ 滑軌槽深 7（不是 7.5）、15 高，每側一條
    const slots = d.parts.flatMap((p) => p.mortises.filter((m) => (m.label ?? "").includes("滑軌槽")));
    expect(slots).toHaveLength(2);
    expect(slots.every((m) => m.depth === 7 && m.width === 15), "滑軌槽 15 高 × 7 深").toBe(true);
    // 鳩尾：只有抽屜前角兩處，1:6（9.46°）、榫深 12 ＝ 18 的 2/3
    const dt = d.parts.filter((p) => p.shape?.kind === "dovetail-ends");
    expect(dt).toHaveLength(2);
    for (const p of dt) {
      const s = p.shape as { angleDeg: number; pinDepth: number; ends: string };
      expect([s.angleDeg, s.pinDepth, s.ends]).toEqual([9.46, 12, "plus"]);
      expect(s.pinDepth, "半隱鳩尾榫深 ＝ 板厚 2/3（§05-10）").toBe(Math.round(18 * 2 / 3));
    }
  });

  it("⭐ 21 支木釘的實際位置：鏈上每個節點都要真的有釘（只驗鏈的加總抓不到擺錯位）", () => {
    const at = (id: string) => {
      const b = worldAABB(part(id));
      return [(b.min.x + b.max.x) / 2 + 236, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2 + 190].map(r1);
    };
    // A 天板↓側板 6：X 30／442（側板 18 厚的中線）、Z 62｜128｜128｜62、入天板 12 ＋ 入側板端 18 ⇒ Y 334~364
    for (const z of [62, 190, 318]) {
      expect(at(`dowel-top-side-0-${z}`), `左側 Z=${z}`).toEqual([30, 349, z]);
      expect(at(`dowel-top-side-1-${z}`), `右側 Z=${z}`).toEqual([442, 349, z]);
    }
    // B 天板↓背板 3：X 55｜160｜160｜55 ＝ 430（由天板左緣 21 起算）
    for (const x of [76, 236, 396]) expect(at(`dowel-top-back-${x}`), `X=${x}`).toEqual([x, 349, 371]);
    // C 背板↔側板 4：Y 34｜64｜34 ＝ 132（由箱內頂 352 下數）；入側板面 12 ＋ 入背板端 18
    //   ⭐ Z＝371 是背板 18 厚的**正中央**（孔打在端面上只能置中）。第一版取 367 是建模方便、不是圖。
    for (const y of [318, 254]) {
      expect(at(`dowel-back-side-0-${y}`), `左 Y=${y}`).toEqual([42, y, 371]);
      expect(at(`dowel-back-side-1-${y}`), `右 Y=${y}`).toEqual([430, y, 371]);
    }
    // D 上橫檔↔側板 4：Z 14｜32｜14 ＝ 60（由上橫檔前緣 21 起算）
    for (const [off, z] of [[14, 35], [46, 67]] as const) {
      expect(at(`dowel-toprail-0-${off}`), `左 Z=${z}`).toEqual([42, 230.5, z]);
      expect(at(`dowel-toprail-1-${off}`), `右 Z=${z}`).toEqual([430, 230.5, z]);
    }
    // E 抽屜後板↔側板 4：Y 21｜40｜21 ＝ 82（由後板頂 342 下數）
    for (const [off, y] of [[21, 321], [61, 281]] as const) {
      expect(at(`dowel-drawer-back-0-${off}`), `左 Y=${y}`).toEqual([62, y, 345.5]);
      expect(at(`dowel-drawer-back-1-${off}`), `右 Y=${y}`).toEqual([410, y, 345.5]);
    }
  });

  it("材料厚度只出現官方發的那幾種；木心板／合板走 override", () => {
    const solid = d.parts.filter((p) => p.visual !== "dowel");
    const thicknesses = [...new Set(solid.map((p) => Math.min(p.visible.length, p.visible.width, p.visible.thickness)))].sort((a, b) => a - b);
    // 4 合板／8 封邊／11 滑軌／15 抽屜側後板／18 木心板＋前板／21 腳柱與橫檔／32 腳座
    expect(thicknesses).toEqual([4, 8, 11, 15, 18, 21, 32]);
    for (const id of ["top-core", "side-panel-left", "side-panel-right", "back-panel"]) {
      expect(part(id).material, `${id} 要是木心板`).toBe("blockboard-primary");
    }
    expect(part("drawer-1-bottom").materialOverride).toBe("plywood");
  });

  it("⭐ 每支榫頭都配得到位置與軸向都對的榫眼（auditJoints 只比尺寸，抓不到這個）", () => {
    const index = buildWorldMortiseIndex(d.parts);
    const pairs: string[] = [];
    for (const p of d.parts) {
      for (const t of p.tenons ?? []) {
        const m = matchMortiseForTenon(p, t, tenonWorld(p, t), index);
        expect(m, `${p.id}/${t.position} 找不到位置對得上的榫眼`).toBeTruthy();
        pairs.push(`${p.id}→${m!.partId}`);
      }
    }
    expect(pairs.sort()).toEqual([
      "leg-left→foot-left", "leg-right→foot-right", "mid-rail→leg-left", "mid-rail→leg-right",
    ]);
  });

  it("⭐ 不貫穿的挖除都不可以比料厚深（挖穿了就是錯）", () => {
    for (const p of d.parts) {
      const stock = [p.visible.length, p.visible.thickness, p.visible.width];
      for (const m of p.mortises) {
        if (m.through) continue;
        const box = mortiseLocalBox(p, m);
        // ⛔ 這裡一定要沿**實際的 depth 軸**比。原本寫 `<= Math.max(...stock)`（料件最長邊）
        //    等於沒有上限，是條死斷言——2026-09-10 回歸檢查員抓到的。
        const alongDepth = { x: p.visible.length, y: p.visible.thickness, z: p.visible.width }[box.depthAxis ?? "y"];
        expect(m.depth, `${p.id} 的「${m.label ?? "?"}」沿 ${box.depthAxis} 軸挖 ${m.depth}，但料件該軸只有 ${alongDepth}`)
          .toBeLessThanOrEqual(alongDepth);
        void stock;
        const half = { x: p.visible.length / 2, y: p.visible.thickness / 2, z: p.visible.width / 2 };
        for (const ax of ["x", "y", "z"] as const) {
          expect(r1(Math.abs(box[`c${ax}`]) + box[`h${ax}`]), `${p.id}/${m.label ?? "?"} 的挖除超出料件 ${ax}`)
            .toBeLessThanOrEqual(half[ax] + 0.01);
        }
      }
    }
  });

  it("⭐ 圖上標了位置的零件要真的在那個位置（回歸檢查員 5 個變異全沒被抓到，補這條）", () => {
    const at = (id: string) => {
      const b = worldAABB(part(id));
      return [b.min.x + 236, b.max.x + 236, b.min.y, b.max.y, b.min.z + 190, b.max.z + 190].map(r1);
    };
    // ① 鎖板腳的 Ø3.5×30：A-A 左鏈 22｜76 由天板底 352 下數 ⇒ Y 330／254（**官方標的**）
    const legScrews = part("side-panel-left").mortises.filter((m) => (m.label ?? "").includes("Ø3.5×30"));
    expect(legScrews).toHaveLength(2);
    const sideCy = 286, sideCz = 190;          // 側板中心（Y 220~352、Z 8~372）
    expect(legScrews.map((m) => r1(sideCy - m.origin.z)).sort((a, b) => b - a), "A-A 的 22｜76 鏈")
      .toEqual([330, 254]);
    expect([352 - 330, 330 - 254], "鏈節點 22｜76").toEqual([22, 76]);
    // 深度方向官方未標，本範本取板腳深度中央 190（不是隨便一個值，改了要有人知道）
    expect(legScrews.map((m) => r1(sideCz - m.origin.x))).toEqual([190, 190]);
    // ② 鎖滑軌的 Ø3×25：**孔開在滑軌木條上、由抽屜側往外鎖**（貫穿 11 ＋ 進側板 14 ＝ 25 全長）。
    //    🩸 開在側板並貫穿是錯的：釘頭會露在箱體外側面，而且 Z179.5 那支在 90 深的板腳背後鎖不進去。
    expect(part("side-panel-left").mortises.filter((m) => (m.label ?? "").includes("Ø3×25")),
      "側板上不該有滑軌螺釘孔").toHaveLength(0);
    const runnerScrews = part("runner-left").mortises.filter((m) => (m.label ?? "").includes("Ø3×25"));
    expect(runnerScrews).toHaveLength(3);
    expect(runnerScrews.every((m) => m.through && m.depth === 11), "要貫穿 11 厚的滑軌木條").toBe(true);
    expect(runnerScrews.map((m) => r1(179.5 - m.origin.x)).sort((a, b) => a - b)).toEqual([81, 179.5, 278]);
    // ③ 滑軌槽前端必須從**肩線 Z21** 起，不可以開到 Z9——那會剖過中間那支鳩尾齒
    //    （槽在距側板底 47~62，中間齒是 40.8~61.2，開到底會讓 14.2mm 的榫頭只剩 8mm 厚）
    const slot = part("drawer-1-side-left").mortises.find((m) => (m.label ?? "").includes("滑軌槽"))!;
    const sb = mortiseLocalBox(part("drawer-1-side-left"), slot);
    const drawerSideCz = 181;                       // 側板 Z 9~353 的中心
    expect([r1(drawerSideCz - (sb.cx + sb.hx)), r1(drawerSideCz - (sb.cx - sb.hx))],
      "滑軌槽的圖面 Z 範圍").toEqual([21, 353]);
    // ④ 滑軌木條：11×14，前端收在抽屜前板背面 Z21（再往前會被關上的抽屜撞到）、後端收在後板前面 Z338
    expect(at("runner-left")).toEqual([39, 50, 293, 307, 21, 338]);
    expect(at("runner-right").slice(0, 2)).toEqual([422, 433]);
    // ⑤ 天板封邊四件：前後通長 430、左右夾在中間 364（**對接**，不是斜切；材料表分不出來，圖上也沒畫）
    expect(at("top-edge-front").slice(0, 2)).toEqual([21, 451]);
    expect(at("top-edge-front").slice(4, 6)).toEqual([0, 8]);
    expect(at("top-edge-back").slice(4, 6)).toEqual([372, 380]);
    expect(at("top-edge-left")).toEqual([21, 29, 352, 370, 8, 372]);
    expect(at("top-edge-right").slice(0, 2)).toEqual([443, 451]);
    expect(r1(at("top-edge-left")[5] - at("top-edge-left")[4]), "左右封邊長 364（對接）").toBe(364);
    // ⑥ 側板前後封邊各 132 長（材料表：一支 550 裁 4 段 132）
    for (const id of ["side-edge-left-front", "side-edge-left-back", "side-edge-right-front", "side-edge-right-back"]) {
      expect(r1(at(id)[3] - at(id)[2]), `${id} 長 132`).toBe(132);
      expect(r1(at(id)[5] - at(id)[4]), `${id} 厚 8`).toBe(8);
    }
  });

  it("⭐ 工序：檢定不塗裝、料已四面鉋光、工時要落在官方 7 小時附近", () => {
    const steps = deriveBuildSteps(d);
    expect(steps.some((s) => s.id === "step-02-jointer-planer"), "檢定料已四面鉋光，不該有平刨厚刨").toBe(false);
    expect(steps.filter((s) => s.phase === "finish"), "檢定不塗裝").toEqual([]);
    for (const id of ["step-08-2-screws", "step-06-2-inspect", "step-05-corner-dovetail"]) {
      expect(steps.some((s) => s.id === id), `缺工序 ${id}`).toBe(true);
    }
    expect(steps.find((s) => s.id === "step-08-2-screws")!.title, "螺釘支數要跟導引孔一致").toContain("13");
    expect(steps.some((s) => s.id === "step-05-8-edging"), "8 條實木封邊要有貼封邊工序").toBe(true);
    // 🩸 categoryFamily 曾把檢定題一個一個列，加第四題漏掉 → 掉進 "other"、工時 8.45h 變 15.77h
    const hours = steps.reduce((a, s) => a + (s.estimatedMinutes ?? 0), 0) / 60;
    expect(hours, "工時應落在官方 7 小時附近；>12 代表 categoryFamily 沒認出這是檢定題").toBeLessThan(12);
  });

  it("⭐ 三視圖真的標得出評審表要量的東西（id 白名單擋掉新命名是這個檔案的老毛病）", () => {
    const svg = renderToStaticMarkup(React.createElement(CompactThreeViews, { design: d, locale: "zh-TW" }));
    expect((svg.match(/NaN|Infinity/g) ?? []), "三視圖不可以有 NaN").toEqual([]);
    expect((svg.match(/<(path|rect|line|polygon)\b/g) ?? []).length, "三視圖幾乎是空的").toBeGreaterThan(100);
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    // 🩸 `leg-left`／`leg-right` 曾被 legs 的 id 白名單擋掉（它要求 left/right 後面一定接 front/back），
    //    `top-rail`／`mid-rail` 曾被 crossPieces 白名單擋掉（它只認 `top-rail-` 有後綴的）。
    //    結果評審表第 2、5 項（總寬 472、腳柱 90×21）與上、中橫檔在三視圖上一個字都沒有。
    expect(texts, "評審表「總寬 472」＝腳柱外對外").toContain("腳外距 472 mm");
    expect(texts, "評審表「腳柱 90×21」").toContain("腳 21×90");
    expect(texts.some((t) => t.startsWith("上橫檔")), "上橫檔沒被標出來").toBe(true);
    expect(texts.some((t) => t.startsWith("中橫檔")), "中橫檔沒被標出來").toBe(true);
    expect(texts, "真實包絡 483（腳座比腳柱寬）").toContain("寬 483 mm");
    expect(texts, "抽屜前板 384×130").toContain("抽面 384×130");
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
      expect(x.overall).toEqual({ length: 483, width: 380, thickness: 370 });
      expect(x.warnings?.some((w) => w.includes("固定")), "夾了要出聲").toBe(true);
      expect(findOverlaps(x.parts)).toEqual([]);
    }
    expect(build({ withDrawer: false }).parts.some((p) => p.id.startsWith("drawer-"))).toBe(false);
    // 拉出量只平移抽屜，箱體不動
    const pulled = build({ drawerPull: 120 });
    expect(r1(worldAABB(pulled.parts.find((p) => p.id === "drawer-1-front")!).min.z + 190)).toBe(-117);
    expect(r1(worldAABB(pulled.parts.find((p) => p.id === "top-rail")!).min.z + 190)).toBe(21);
    expect(build({ drawerPull: -50 }).warnings?.some((w) => w.includes("夾到")), "負值要夾且出聲").toBe(true);
  });
});
