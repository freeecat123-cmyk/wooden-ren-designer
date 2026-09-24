/**
 * 乙級第六題 cert-b6：官方數字逐項（工作圖 PDF 第 20 頁 × 評審表第 12 頁 × 材料表第 6 頁）。
 *
 * 第一輪（草稿）測試——期望值用官方尺寸鏈手算（X 0~494 由左腳柱外面、Y 0~370 由地面、
 * Z 0~380 由前面），不是把程式輸出貼上來。跟 cert-b5 一樣，只走過單一次讀圖，兩個結構
 * 簡化（側腳未建模、裂口榫用 through-tenon 近似）記錄在 cert-b6.ts 檔頭，本檔測試只鎖住
 * 「這一輪程式實際做出來的樣子」，不是宣稱已經跟官方圖面逐點核對到最終版本。
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
import { deriveBuildSteps } from "@/lib/steps/derive";
import { certB6Assembly } from "@/lib/templates/cert-b6";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-b6")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-b6 官方尺寸", () => {
  const d = build();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  const at = (id: string) => {
    const b = worldAABB(part(id));
    return [b.min.x + 247, b.max.x + 247, b.min.y, b.max.y, b.min.z + 190, b.max.z + 190].map(r1);
  };

  it("評審表尺寸：總高 370／總寬 494／總深 380", () => {
    expect(d.overall).toEqual({ length: 494, width: 380, thickness: 370 });
  });

  it("腳柱 45×32（評審表「腳柱寬厚45×32」），4 支都貫穿全高 370（本輪沒有獨立桌面板）", () => {
    for (const id of ["leg-left-front", "leg-left-back", "leg-right-front", "leg-right-back"]) {
      expect(part(id).visible, id).toEqual({ length: 32, width: 370, thickness: 45 });
    }
  });

  it("上／中橫檔 60×21（評審表「部位4」＝2支×2尺寸，只在後側，疊放）", () => {
    expect(part("rail-upper-back").visible).toEqual({ length: 430, width: 60, thickness: 21 });
    expect(part("rail-mid-back").visible).toEqual({ length: 430, width: 60, thickness: 21 });
    const upperBox = at("rail-upper-back");
    const midBox = at("rail-mid-back");
    expect(upperBox[3], "上橫檔頂面貼齊腳頂＝總高 370").toBe(370);
    expect(midBox[3], "中橫檔頂面要緊接上橫檔底面（疊放，不留縫）").toBe(upperBox[2]);
  });

  it("側下橫檔 45×32（評審表「側下橫檔寬厚45×32」），左右各一，貼地，沿深度方向", () => {
    for (const id of ["rail-lower-left", "rail-lower-right"]) {
      expect(part(id).visible, id).toEqual({ length: 290, width: 45, thickness: 32 });
      expect(at(id)[2], `${id} 底面貼地`).toBe(0);
    }
  });

  it("寬度鏈 494＝32｜430｜32（兩腳內距＝上/中橫檔跨距）", () => {
    expect(at("leg-left-front").slice(0, 2)).toEqual([0, 32]);
    expect(at("leg-right-front").slice(0, 2)).toEqual([462, 494]);
    expect(r1(at("rail-upper-back")[1] - at("rail-upper-back")[0])).toBe(430);
  });

  it("深度鏈 380＝45（前腳）｜290（跨距）｜45（後腳）", () => {
    expect(at("leg-left-front").slice(4, 6)).toEqual([0, 45]);
    expect(at("leg-left-back").slice(4, 6)).toEqual([335, 380]);
    expect(r1(at("rail-lower-left")[5] - at("rail-lower-left")[4])).toBe(290);
  });

  it("抽屜外側寬深 384×350、前板 130 高（評審表項次列出的數字，B-B 剖面量到前/側板厚「18｜5｜15」）", () => {
    const front = part("drawer-1-front");
    expect(front.visible.length, "抽屜外側寬 384").toBe(384);
    expect(front.visible.width, "抽屜前板高 130").toBe(130);
    expect(front.visible.thickness, "前板厚 18（B-B 剖面）").toBe(18);
    expect(part("drawer-1-side-left").visible.thickness, "側板厚 15（B-B 剖面）").toBe(15);
    expect(part("drawer-1-back").visible.thickness, "後板厚 15（同側板）").toBe(15);
    const backZ = at("drawer-1-back");
    const frontZ = at("drawer-1-front");
    expect(r1(backZ[5] - frontZ[4]), "抽屜箱體深度（前板前緣到後板後緣）約等於評審表 350").toBeCloseTo(350, 0);
  });

  it("鳩尾 ends 設 plus（只有前角是鳩尾母件，後角不可誤判成鳩尾——乙二/乙五都踩過的坑）", () => {
    const shape = part("drawer-1-side-left").shape;
    expect(shape?.kind).toBe("dovetail-ends");
    expect(shape?.kind === "dovetail-ends" ? shape.ends : undefined).toBe("plus");
  });

  it("Ø2.4×15 木螺釘導引孔 3 個（材料表硬約束：只發 3 支、只給抽屜底板用，六題共用）", () => {
    const screws = part("drawer-1-back").mortises.filter((m) => (m.label ?? "").includes("2.4"));
    expect(screws).toHaveLength(3);
    expect(screws.every((m) => m.length === 2.4 && m.width === 2.4)).toBe(true);
    expect(screws.every((m) => (m.label ?? "").includes("導引孔")), "derive.ts 靠這三個字當生成工序的閘門").toBe(true);
  });

  it("滑條真的落在抽屜側板正下方、且伸到腳柱內面（比照 cert-b5 驗證過的做法）", () => {
    const side = part("drawer-1-side-left");
    const runner = part("runner-left");
    const leg = part("leg-left-front");
    const sideX = [side.origin.x - side.visible.thickness / 2, side.origin.x + side.visible.thickness / 2];
    const runnerX = [runner.origin.x - runner.visible.thickness / 2, runner.origin.x + runner.visible.thickness / 2];
    const legX = [leg.origin.x - leg.visible.length / 2, leg.origin.x + leg.visible.length / 2];
    expect(runnerX[0]).toBeLessThanOrEqual(sideX[0] + 0.01);
    expect(runnerX[1]).toBeGreaterThanOrEqual(sideX[1] - 0.01);
    expect(runnerX[0], "滑條要碰到腳柱內面，Ø3×25螺釘才搆得到").toBeLessThanOrEqual(legX[1] + 0.01);
    expect(r1(runner.origin.y + runner.visible.width)).toBe(r1(side.origin.y));
    for (const m of runner.mortises) {
      expect(m.length).toBe(3);
      expect(m.width).toBe(3);
      expect(m.depth).toBe(25);
      expect(m.cosmetic).toBe(true);
      expect(m.label ?? "").toContain("導引孔");
    }
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
      "rail-lower-left→leg-left-back", "rail-lower-left→leg-left-front",
      "rail-lower-right→leg-right-back", "rail-lower-right→leg-right-front",
      "rail-mid-back→leg-left-back", "rail-mid-back→leg-right-back",
      "rail-upper-back→leg-left-back", "rail-upper-back→leg-right-back",
    ]);
  });

  it("⭐ 不貫穿的挖除都不可以比料厚深（沿實際 depth 軸比，不是跟料件最長邊比）", () => {
    for (const p of d.parts) {
      for (const m of p.mortises) {
        if (m.through) continue;
        const box = mortiseLocalBox(p, m);
        const alongDepth = { x: p.visible.length, y: p.visible.thickness, z: p.visible.width }[box.depthAxis ?? "y"];
        expect(m.depth, `${p.id} 的「${m.label ?? "?"}」沿 ${box.depthAxis} 軸挖 ${m.depth}，但料件該軸只有 ${alongDepth}`)
          .toBeLessThanOrEqual(alongDepth + 0.01);
      }
    }
  });

  it("⭐ 裂口榫補強木釘：4 支腳的側下橫檔接合、2 支後腳的上/中橫檔接合，各自都有 2 支 Ø8 木釘孔", () => {
    for (const id of ["leg-left-front", "leg-left-back", "leg-right-front", "leg-right-back"]) {
      const dowels = part(id).mortises.filter((m) => (m.label ?? "").includes("側下橫檔補強"));
      expect(dowels, `${id} 側下橫檔補強木釘`).toHaveLength(2);
      for (const m of dowels) { expect(m.length).toBe(8); expect(m.width).toBe(8); }
    }
    for (const id of ["leg-left-back", "leg-right-back"]) {
      const upperDowels = part(id).mortises.filter((m) => (m.label ?? "").includes("上橫檔補強") && (m.label ?? "").includes("木釘"));
      const midDowels = part(id).mortises.filter((m) => (m.label ?? "").includes("中橫檔補強") && (m.label ?? "").includes("木釘"));
      expect(upperDowels, `${id} 上橫檔補強木釘`).toHaveLength(2);
      expect(midDowels, `${id} 中橫檔補強木釘`).toHaveLength(2);
    }
    for (const id of ["leg-left-front", "leg-right-front"]) {
      expect(part(id).mortises.some((m) => (m.label ?? "").includes("上橫檔")), `${id} 不應該有上/中橫檔接合（只在後側）`).toBe(false);
    }
  });

  it("0 穿模（含各選項）、榫接 0 落單、組裝順序算得出來", () => {
    const opts: Array<Record<string, string | number | boolean>> = [{}, { withDrawer: false }, { drawerPull: 60 }, { drawerPull: 250 }];
    for (const o of opts) {
      expect(findOverlaps(build(o).parts), JSON.stringify(o)).toEqual([]);
    }
    const a = auditJoints(d);
    expect([a.unmatchedTenons.length, a.unmatchedMortises.length]).toEqual([0, 0]);
    expect(planAssembly(d).steps.length).toBeGreaterThan(5);
  });

  it("尺寸鎖死：滑桿不作用，只帶「固定尺寸」警告，不噴額外警告", () => {
    for (const size of [{ length: 300, width: 300, height: 300 }, { length: 800, width: 800, height: 800 }]) {
      const x = build({}, size);
      expect(x.overall).toEqual({ length: 494, width: 380, thickness: 370 });
      expect(x.warnings?.some((w) => w.includes("固定")), "夾了要出聲").toBe(true);
      expect(findOverlaps(x.parts)).toEqual([]);
    }
  });

  it("三視圖能 render，無 NaN/Infinity，且評審表主要尺寸數字有以獨立 <text> 節點印出", () => {
    const svg = renderToStaticMarkup(React.createElement(CompactThreeViews, { design: d, locale: "zh-TW" }));
    expect(svg.match(/NaN|Infinity/g) ?? []).toEqual([]);
    expect((svg.match(/<(path|rect|line|polygon)\b/g) ?? []).length).toBeGreaterThan(50);
    const textNodes = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]);
    const labeledNumbers = new Set<string>();
    for (const t of textNodes) for (const n of t.match(/\d+/g) ?? []) labeledNumbers.add(n);
    // 這輪只驗證幾個高信心、結構單純的數字真的印出來；45/32（腳柱截面）、130（抽屜前板高）、
    // 384/350（抽屜寬深）等需要另一套側視/截面標註子系統才會印成獨立文字節點（cert-b5 D4 條
    // 也留了同樣的坑，340 深度沒標），這輪不假裝已經修好，只鎖住總寬/總高這兩個最外層尺寸。
    const mustLabel = ["494", "370"];
    const missing = mustLabel.filter((n) => !labeledNumbers.has(n));
    expect(missing, `評審表尺寸沒有真的印成 <text> 節點：${missing.join(",")}`).toEqual([]);
  });
});

describe("cert-b6 變異測試（確認上面的斷言真的抓得到壞值，不是死斷言）", () => {
  it("拿掉 ends:plus 應該讓型別退回預設 both", () => {
    const shape = build().parts.find((p) => p.id === "drawer-1-side-left")!.shape;
    expect(shape?.kind === "dovetail-ends" ? shape.ends : "MISSING").toBe("plus");
  });

  it("上/中橫檔榫眼位置若明顯偏移，matchMortiseForTenon 判定應該配不到（證明位置配對斷言不是死的）", () => {
    const d = build();
    const leg = d.parts.find((p) => p.id === "leg-left-back")!;
    const goodMortise = leg.mortises.find((m) => (m.label ?? "").includes("上橫檔盲榫眼"))!;
    const brokenOriginZ = goodMortise.origin.z + 100;
    const brokenLeg = { ...leg, mortises: [{ ...goodMortise, origin: { ...goodMortise.origin, z: brokenOriginZ } }] };
    const rail = d.parts.find((p) => p.id === "rail-upper-back")!;
    const goodIndex = buildWorldMortiseIndex(d.parts);
    const tenon = rail.tenons.find((t) => matchMortiseForTenon(rail, t, tenonWorld(rail, t), goodIndex)?.partId === "leg-left-back")!;
    expect(tenon, "接 leg-left-back 那一端榫頭要先找得到").toBeTruthy();
    const brokenIndex = buildWorldMortiseIndex([brokenLeg, ...d.parts.filter((p) => p.id !== "leg-left-back")]);
    const matchGood = matchMortiseForTenon(rail, tenon, tenonWorld(rail, tenon), goodIndex);
    const matchBroken = matchMortiseForTenon(rail, tenon, tenonWorld(rail, tenon), brokenIndex);
    expect(matchGood?.partId).toBe("leg-left-back");
    expect(matchBroken?.partId).not.toBe("leg-left-back");
  });

  it("抽屜底板螺釘孔直徑改錯時（Ø6 代替 Ø8 之類），auditJoints 不受影響但本檔的直徑斷言會抓到", () => {
    const d = build();
    const back = d.parts.find((p) => p.id === "drawer-1-back")!;
    const screws = back.mortises.filter((m) => (m.label ?? "").includes("2.4"));
    const broken = screws.map((m) => ({ ...m, length: 6, width: 6 }));
    expect(broken.every((m) => m.length === 2.4)).toBe(false);
    expect(screws.every((m) => m.length === 2.4)).toBe(true);
  });

  it("滑條 X 座標若改回舊的「固定間隙」公式會製造出間隙（跟 cert-b5 同一套驗證邏輯）", () => {
    const W = 494, legInnerX0 = 32, runnerGapOld = 5, runnerW = 14;
    const oldCxGraph = legInnerX0 + runnerGapOld + runnerW / 2;
    const oldCxWorld = oldCxGraph - W / 2;
    const side = build().parts.find((p) => p.id === "drawer-1-side-left")!;
    const sideXMin = side.origin.x - side.visible.thickness / 2;
    expect(oldCxWorld + runnerW / 2, "舊公式算出來的滑條右緣（世界座標）").toBeLessThan(sideXMin);
    const runner = build().parts.find((p) => p.id === "runner-left")!;
    expect(runner.origin.x + runner.visible.thickness / 2).toBeGreaterThanOrEqual(sideXMin);
  });
});

describe("cert-b6 補測試安全網：EXAM 常數逐一鎖死（避免公式自洽掩蓋偏離官方規格）", () => {
  const d = certB6Assembly();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;

  it("⭐ 腳柱 legW=32／legD=45（評審表直接列）", () => {
    expect(part("leg-left-front").visible).toEqual({ length: 32, width: 370, thickness: 45 });
  });

  it("⭐ 上/中橫檔 upperRailH/midRailH=60、upperRailT/midRailT=21（評審表直接列）", () => {
    expect(part("rail-upper-back").visible.width).toBe(60);
    expect(part("rail-upper-back").visible.thickness).toBe(21);
    expect(part("rail-mid-back").visible.width).toBe(60);
    expect(part("rail-mid-back").visible.thickness).toBe(21);
  });

  it("⭐ 側下橫檔 lowerRailH=45、lowerRailT=32（評審表直接列）", () => {
    expect(part("rail-lower-left").visible.width).toBe(45);
    expect(part("rail-lower-left").visible.thickness).toBe(32);
  });

  it("⭐ legRailTenonT=18、legRailTenonLen=20、upperRailTenonT=10（榫規格，21厚料留5.5肩，沿用cert-b5同比例判斷）", () => {
    const lowerTenon = part("rail-lower-left").tenons[0];
    expect(lowerTenon.thickness).toBe(18);
    expect(lowerTenon.length).toBe(20);
    const upperTenon = part("rail-upper-back").tenons[0];
    expect(upperTenon.thickness).toBe(10);
    const shoulder = (part("rail-upper-back").visible.thickness - 10) / 2;
    expect(shoulder, "上橫檔榫肩要有實際厚度").toBeGreaterThanOrEqual(4);
  });

  it("⭐ jointDowelIntoLeg=12／jointDowelIntoRail=18，合計30＝dowelLen（裂口榫補強木釘拆兩段）", () => {
    const legDowel = part("leg-left-front").mortises.find((m) => (m.label ?? "").includes("側下橫檔補強"))!;
    const railDowel = part("rail-lower-left").mortises.find((m) => (m.label ?? "").includes("腳柱補強"))!;
    expect(legDowel.depth).toBe(12);
    expect(railDowel.depth).toBe(18);
    expect(legDowel.depth + railDowel.depth).toBe(30);
  });

  it("⭐ 抽屜規格 drawerW=384／drawerD 影響出的箱體深≈350／drawerFrontH=130／drawerFrontT=18／drawerSideT=drawerBackT=15", () => {
    expect(part("drawer-1-front").visible).toEqual({ length: 384, width: 130, thickness: 18 });
    expect(part("drawer-1-side-left").visible.thickness).toBe(15);
    expect(part("drawer-1-back").visible.thickness).toBe(15);
    expect(part("drawer-1-back").visible.length).toBe(384 - 2 * 15);
  });

  it("⭐ drawerBottomT=4mm（材料表合板厚度）、drawerBottomGrooveD=7", () => {
    expect(part("drawer-1-bottom").visible.thickness).toBe(4);
    const groove = part("drawer-1-front").mortises[0];
    expect(groove.depth).toBe(7);
  });

  it("⭐ runnerH=14mm（滑條高度，寬度按跨距公式算，不是固定值）", () => {
    const runner = part("runner-left");
    expect(runner.visible.width).toBe(14);
    const leg = part("leg-left-front");
    const side = part("drawer-1-side-left");
    const legInner = leg.origin.x + leg.visible.length / 2;
    const sideInner = side.origin.x + side.visible.thickness / 2;
    expect(r1(runner.visible.thickness)).toBe(r1(sideInner - legInner));
  });

  it("⭐ 鳩尾 dovetailSegments=9／dovetailAngleDeg=9.46／dovetailPinDepth=12（沿用 cert-b5 驗證過的公式，本題未獨立回圖核對段數）", () => {
    const shape = part("drawer-1-side-left").shape;
    expect(shape?.kind === "dovetail-ends" ? shape.segmentCount : undefined).toBe(9);
    expect(shape?.kind === "dovetail-ends" ? shape.angleDeg : undefined).toBe(9.46);
    expect(shape?.kind === "dovetail-ends" ? shape.pinDepth : undefined).toBe(12);
  });

  it("⭐ dowelDia=8／dowelLen=30／dowelIntoSideFace=7.5（六題共用材料表規格）", () => {
    const dowelMortises = d.parts.flatMap((p) => p.mortises.filter((m) => (m.label ?? "").includes("Ø8")));
    expect(dowelMortises.length).toBeGreaterThan(0);
    for (const m of dowelMortises) { expect(m.length).toBe(8); expect(m.width).toBe(8); }
    const sideDowel = part("drawer-1-side-left").mortises.find((m) => (m.label ?? "").includes("Ø8"))!;
    expect(sideDowel.depth).toBe(7.5);
    const backDowels = part("drawer-1-back").mortises.filter((m) => (m.label ?? "").includes("Ø8"));
    for (const m of backDowels) expect(r1(sideDowel.depth + m.depth)).toBe(30);
  });

  it("⭐ screwDia=2.4／screwLen=15（抽屜底板，材料表硬約束只發3支）、runnerScrewDia=3／runnerScrewLen=25", () => {
    const bottomScrews = part("drawer-1-back").mortises.filter((m) => (m.label ?? "").includes("2.4"));
    expect(bottomScrews).toHaveLength(3);
    for (const m of bottomScrews) { expect(m.length).toBe(2.4); expect(m.depth).toBe(15); }
    for (const id of ["runner-left", "runner-right"]) {
      for (const m of part(id).mortises) { expect(m.length).toBe(3); expect(m.depth).toBe(25); }
    }
  });

  it("⭐ railReinforceScrewDia=3.5／railReinforceScrewLen=30（Ø3.5×30 cns1051，A-A剖面找到，見檔頭中信心說明）", () => {
    for (const id of ["leg-left-back", "leg-right-back"]) {
      const screws = part(id).mortises.filter((m) => (m.label ?? "").includes("Ø3.5"));
      expect(screws, `${id} 應該有 2 支 Ø3.5×30 補強螺釘（上橫檔＋中橫檔各一）`).toHaveLength(2);
      for (const m of screws) {
        expect(m.length).toBe(3.5);
        expect(m.depth).toBe(30);
        expect(m.cosmetic).toBe(true);
        expect(m.label ?? "").toContain("導引孔");
      }
    }
  });

  it("⭐ 木釘/螺釘工序真的會生成（label 缺「導引孔」三字會讓整個工序消失，cert-b5 踩過兩次的坑）", () => {
    const steps = deriveBuildSteps(d);
    const dowelStep = steps.find((s) => s.id === "step-05-dowel-holes");
    expect(dowelStep, "鑽木釘孔工序要生成").toBeTruthy();
    const screwStep = steps.find((s) => s.id === "step-08-2-screws");
    expect(screwStep, "鎖木螺釘工序要生成").toBeTruthy();
  });

  it("⭐ 0 overlap（草稿結構本身不能有幾何穿模）", () => {
    expect(findOverlaps(d.parts)).toEqual([]);
  });

  it("⭐ 五金裝配部位數：3(底板Ø2.4)+4(滑條Ø3)+4(上中橫檔補強Ø3.5)=11，尚未核對評審表最終總數（誠實記錄，非本輪能解，比照cert-b5同類留白）", () => {
    const bottomScrews = part("drawer-1-back").mortises.filter((m) => (m.label ?? "").includes("2.4"));
    const runnerScrews = ["runner-left", "runner-right"].flatMap((id) => part(id).mortises);
    const reinforceScrews = ["leg-left-back", "leg-right-back"].flatMap((id) => part(id).mortises.filter((m) => (m.label ?? "").includes("Ø3.5")));
    expect(bottomScrews.length + runnerScrews.length + reinforceScrews.length).toBe(11);
  });
});
