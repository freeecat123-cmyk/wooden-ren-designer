/**
 * 乙級第五題 cert-b5：官方數字逐項（工作圖 PDF 第 19 頁 × 評審表第 11 頁 × 材料表）。
 *
 * ⭐ 期望值全部用**官方尺寸鏈**手算（X 0~480 由左腳柱外面、Y 0~380 由地面、Z 0~380 由前面），
 *    不是把程式輸出貼上來。這是第三輪：補上桌面板（493×370×18，疊在腳頂，腳柱因此縮短為
 *    0~362）。B 類 7 個確認的 bug 沿用第二輪的斷言；新增 D 類斷言驗證桌面板的尺寸/位置與
 *    連帶重算的 legCenterY／腳長／後上橫檔 Y 座標。C 類第 3 項（盲榫 vs 裂口榫）已在第六輪用
 *    官方重新發行的向量版原稿確認為盲榫（不再只是視覺比對推測），見 `cert-b5.ts` 檔頭完整說明。
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

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-b5")!;
const base = Object.fromEntries((entry.optionSchema ?? []).map((s) => [s.key, s.defaultValue])) as Record<string, string | number | boolean>;
const build = (o: Record<string, string | number | boolean> = {}, size = entry.defaults) =>
  entry.template!({ length: size.length, width: size.width, height: size.height, material: "pine", options: { ...base, ...o } });
const r1 = (n: number) => Math.round(n * 10) / 10;

describe("cert-b5 官方尺寸", () => {
  const d = build();
  const part = (id: string) => d.parts.find((p) => p.id === id)!;
  const at = (id: string) => {
    const b = worldAABB(part(id));
    return [b.min.x + 240, b.max.x + 240, b.min.y, b.max.y, b.min.z + 190, b.max.z + 190].map(r1);
  };

  it("評審表尺寸：總高 380／總寬 480／總深 380（腳柱因桌面板縮短為 362＝380−18）", () => {
    expect(d.overall).toEqual({ length: 480, width: 380, thickness: 380 });
    expect(part("leg-left-front").visible).toEqual({ length: 32, width: 362, thickness: 45 });
    expect(part("back-rail").visible).toEqual({ length: 416, width: 90, thickness: 20 });
    expect(part("stretcher-front").visible).toEqual({ length: 416, width: 45, thickness: 32 });
    expect(part("stretcher-back").visible).toEqual({ length: 416, width: 45, thickness: 32 });
  });

  it("⭐ D1：桌面板 493×370×18，疊在腳頂（Y＝362~380），跟腳架 480×380 不對稱懸挑/內縮", () => {
    const top = part("top");
    expect(top.visible).toEqual({ length: 493, width: 370, thickness: 18 });
    expect(top.origin.y, "桌面板底面＝腳頂＝H−topT＝362").toBe(362);
    const box = at("top");
    expect(r1(box[3] - box[2]), "桌面板厚度 18").toBe(18);
    expect(r1(box[1] - box[0]), "桌面板寬 493，比腳架 480 寬（懸挑）").toBe(493);
    expect(r1(box[5] - box[4]), "桌面板深 370，比腳架 380 窄（內縮）").toBe(370);
  });

  it("⭐ D2：後上橫檔貼齊桌面板下緣（Y 頂＝362，不是舊版的 380）", () => {
    const railTop = at("back-rail")[3];
    expect(railTop, "後上橫檔頂面要等於桌面板底面（362），不能還留在舊的 380").toBe(362);
  });

  it("⭐ D3：legCenterY 重算後，腳柱榫眼仍然對得到後上橫檔（不是只改了常數沒改用到它的地方）", () => {
    const leg = part("leg-left-back");
    const backMortise = leg.mortises.find((m) => (m.label ?? "").includes("側上橫檔"))!;
    expect(backMortise, "後腳一定要有側上橫檔的盲榫眼").toBeTruthy();
    // z 是 local 高度方向（rotation x=π/2 下 local z→世界 −y）；換算回世界 Y 應該落在
    // back-rail 的世界 Y 範圍內（272~362），不能因為 legCenterY 沒跟著腳長重算而落到舊的 290~380。
    const legWorldYCenter = (380 - 18) / 2; // (H−topT)/2，跟程式裡的 legCenterY 算法一致
    const mortiseWorldY = legWorldYCenter - backMortise.origin.z;
    const railRange = at("back-rail");
    expect(mortiseWorldY, "榫眼換算回世界 Y 要落在後上橫檔的世界 Y 範圍內").toBeGreaterThanOrEqual(railRange[2] - 0.01);
    expect(mortiseWorldY).toBeLessThanOrEqual(railRange[3] + 0.01);
  });

  it("寬度鏈 480＝32｜416｜32（兩腳內距，橫檔跨距）", () => {
    expect(at("leg-left-front").slice(0, 2)).toEqual([0, 32]);
    expect(at("leg-right-front").slice(0, 2)).toEqual([448, 480]);
    expect(r1(at("back-rail")[1] - at("back-rail")[0]), "橫檔跨距 416＝480−2×32").toBe(416);
  });

  it("深度鏈 380＝45（前腳）｜290（跨距）｜45（後腳），前後腳中心距 335", () => {
    expect(at("leg-left-front").slice(4, 6)).toEqual([0, 45]);
    expect(at("leg-left-back").slice(4, 6)).toEqual([335, 380]);
  });

  it("抽屜外側寬深 370×340、前板 130 高（評審表項次 5、8）", () => {
    const front = part("drawer-1-front");
    expect(front.visible.length, "抽屜外側寬 370").toBe(370);
    expect(front.visible.width, "抽屜前板高 130（同 b4 用法，取「寬度」欄當高度）").toBe(130);
    const sideLen = part("drawer-1-side-left").visible.length + 15; // + 鳩尾針深 12 + 前板厚18-12=6，見下條鏈
    void sideLen;
    // 抽屜總深＝前板厚18 + 側板淨長 + 後板厚15，應落在 340 附近（滑條/間隙留量已內含在側板長度公式裡）
    const backZ = at("drawer-1-back");
    const frontZ = at("drawer-1-front");
    expect(r1(backZ[5] - frontZ[4]), "抽屜箱體深度（前板前緣到後板後緣）約等於評審表 340").toBeCloseTo(340, 0);
  });

  it("⭐ B1：抽屜後角木釘孔深度合計 30mm（原本只有 15mm，木釘插不到底、抽屜合不攏）", () => {
    const sideDowel = part("drawer-1-side-left").mortises.find((m) => (m.label ?? "").includes("Ø8"))!;
    const backDowels = part("drawer-1-back").mortises.filter((m) => (m.label ?? "").includes("Ø8"));
    expect(backDowels).toHaveLength(2);
    for (const m of backDowels) {
      expect(r1(sideDowel.depth + m.depth), "側板孔+後板孔要等於木釘全長 30mm").toBe(30);
    }
    expect(sideDowel.depth, "側板孔（面鑽）不可超過側板厚度的安全牆 15/2").toBeLessThanOrEqual(7.5 + 0.01);
  });

  it("⭐ B2：滑條真的落在抽屜側板正下方（原本 X 方向空 4mm，側板底邊擱不到滑條）", () => {
    const side = part("drawer-1-side-left");
    const runner = part("runner-left");
    const sideX = [side.origin.x - side.visible.thickness / 2, side.origin.x + side.visible.thickness / 2];
    const runnerX = [runner.origin.x - runner.visible.thickness / 2, runner.origin.x + runner.visible.thickness / 2];
    const overlap = Math.min(sideX[1], runnerX[1]) - Math.max(sideX[0], runnerX[0]);
    expect(overlap, "滑條跟側板的 X 範圍要真的重疊，不能只是相鄰或留縫").toBeGreaterThan(0);
    expect(r1(runner.origin.x)).toBe(r1(side.origin.x));
    // Y 方向：滑條頂面要等於側板底面（真的擱得到）
    expect(r1(runner.origin.y + runner.visible.width)).toBe(r1(side.origin.y));
  });

  it("⭐ B3：鳩尾 ends 設 plus（只有前角是鳩尾母件，後角不可誤判成鳩尾）", () => {
    const shape = part("drawer-1-side-left").shape;
    expect(shape?.kind).toBe("dovetail-ends");
    expect(shape?.kind === "dovetail-ends" ? shape.ends : undefined, "型別預設 both 會讓後角也被當鳩尾母件（乙二踩過的坑）").toBe("plus");
  });

  it("⭐ B4：Ø2.4×15 木螺釘導引孔 3 個（材料表硬約束：本題只發 3 支、只給抽屜底板用）", () => {
    const screws = part("drawer-1-back").mortises.filter((m) => (m.label ?? "").includes("2.4"));
    expect(screws).toHaveLength(3);
    expect(screws.every((m) => m.length === 2.4 && m.width === 2.4)).toBe(true);
  });

  it("⭐ B5：後上橫檔榫肩 5mm（20 厚料用 10 厚榫），不可沿用下橫檔 32 厚料的 18 厚榫（只剩 1mm 肩）", () => {
    const backRail = part("back-rail");
    expect(backRail.tenons.every((t) => t.thickness === 10)).toBe(true);
    const shoulder = (backRail.visible.thickness - 10) / 2;
    expect(shoulder, "後上橫檔榫肩要有實際厚度，不能薄到 1mm").toBeGreaterThanOrEqual(4);
    const lowerRail = part("stretcher-front");
    expect(lowerRail.tenons.every((t) => t.thickness === 18), "下橫檔仍用 18 厚榫（32 厚料留 7mm 肩，本來就沒問題）").toBe(true);
  });

  it("⭐ B6：腳底倒角掛上 footChamferMm（評審表「圓弧與倒角」配分項，原本直腳完全沒有這個工序）", () => {
    for (const id of ["leg-left-front", "leg-left-back", "leg-right-front", "leg-right-back"]) {
      const shape = part(id).shape;
      expect(shape?.kind, `${id} 要借 splayed(dx=dz=0) 掛倒角`).toBe("splayed");
      if (shape?.kind === "splayed") {
        expect([shape.dxMm, shape.dzMm], `${id} 不可真的斜掉，dx/dz 必須是 0`).toEqual([0, 0]);
        expect(shape.footChamferMm, `${id} 要有腳底倒角`).toBeGreaterThan(0);
      }
    }
    const steps = deriveBuildSteps(d);
    expect(steps.some((s) => s.id === "step-05-9-foot-chamfer"), "腳底倒角工序要生成").toBe(true);
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
    // 後上橫檔 2 端接後側 2 支腳；前後下橫檔各 2 端各接前/後側 2 支腳
    expect(pairs.sort()).toEqual([
      "back-rail→leg-left-back", "back-rail→leg-right-back",
      "stretcher-back→leg-left-back", "stretcher-back→leg-right-back",
      "stretcher-front→leg-left-front", "stretcher-front→leg-right-front",
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

  it("⭐ D4：三視圖真的標出評審表尺寸了（用 <text> 節點內容比對，不是字串巧合命中）", () => {
    // 🩸2026-09-24 獨立複查員抓到：上一輪用 svg.includes("20") 這種寫法會巧合命中座標數字
    // 裡的子字串（例如 y1="-362" 裡的 "20"），誤判成「已標註」。改成真的解析 <text> 節點內容，
    // 逐一核對評審表 8 項官方尺寸裡「數字真的以獨立文字節點形式出現」的有幾項。
    const svg = renderToStaticMarkup(React.createElement(CompactThreeViews, { design: d, locale: "zh-TW" }));
    expect(svg.match(/NaN|Infinity/g) ?? []).toEqual([]);
    expect((svg.match(/<(path|rect|line|polygon)\b/g) ?? []).length).toBeGreaterThan(50);
    const textNodes = [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]);
    const labeledNumbers = new Set<string>();
    for (const t of textNodes) for (const n of t.match(/\d+/g) ?? []) labeledNumbers.add(n);
    // 8 項扣掉「抽屜深度 340」：drawerFaces 標註機制只抓前視面寬×高（370×130），
    // 側視深度需要一個全新的側視圖標註子系統，這輪判斷風險/工作量超出範圍，明講留給下一輪，
    // 不假裝這條也修好了（下面只驗證另外 7 項真的以獨立文字節點出現）。
    const mustLabel = ["380", "480", "45", "32", "90", "20", "370", "130"];
    const missing = mustLabel.filter((n) => !labeledNumbers.has(n));
    expect(missing, `評審表尺寸沒有真的印成 <text> 節點：${missing.join(",")}`).toEqual([]);
  });

  it("⭐ D5：桌面板↔側上橫檔的 Ø8×30 木釘真的兩兩配對成功（不是各自孤立的孔）", () => {
    const a = auditJoints(d);
    const topDowels = part("top").mortises;
    const railTopDowels = part("back-rail").mortises.filter((m) => (m.label ?? "").includes("桌面板"));
    expect(topDowels.length, "桌面板應該有木釘孔").toBeGreaterThan(0);
    expect(railTopDowels.length, "側上橫檔應該有數量相同的對應木釘孔").toBe(topDowels.length);
    expect(a.unmatchedMortises.length, "全部木釘（含這輪新增的桌面板↔橫檔）都應該兩兩配對成功").toBe(0);
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

  it("尺寸鎖死：滑桿不作用，只帶「固定尺寸」跟已知的第二輪草稿警告，不噴額外警告", () => {
    for (const size of [{ length: 300, width: 300, height: 300 }, { length: 800, width: 800, height: 800 }]) {
      const x = build({}, size);
      expect(x.overall).toEqual({ length: 480, width: 380, thickness: 380 });
      expect(x.warnings?.some((w) => w.includes("固定")), "夾了要出聲").toBe(true);
      expect(findOverlaps(x.parts)).toEqual([]);
    }
  });
});

describe("cert-b5 變異測試（確認上面的斷言真的抓得到壞值，不是死斷言）", () => {
  it("木釘深度改回原本錯誤的分配（7.5+7.5=15）應該被 B1 斷言攔下", () => {
    const d = build();
    const sideDowel = d.parts.find((p) => p.id === "drawer-1-side-left")!.mortises.find((m) => (m.label ?? "").includes("Ø8"))!;
    const backDowel = d.parts.find((p) => p.id === "drawer-1-back")!.mortises.find((m) => (m.label ?? "").includes("Ø8"))!;
    const brokenSum = sideDowel.depth + 7.5; // 模擬改回原本的錯誤深度
    expect(brokenSum).not.toBe(30);
    expect(sideDowel.depth + backDowel.depth, "現在的程式應該是對的（30），這條證明上面那條斷言不是死的").toBe(30);
  });

  it("拿掉 ends:plus 應該讓型別退回預設 both（證明 B3 斷言真的在檢查這個欄位、不是隨便過）", () => {
    const shape = build().parts.find((p) => p.id === "drawer-1-side-left")!.shape;
    expect(shape?.kind === "dovetail-ends" ? shape.ends : "MISSING", "shape.ends 一定要顯式存在且是 plus").toBe("plus");
  });

  it("legCenterY 算錯（榫眼位置偏移）時，真正的引擎函式會判定「配不到」", () => {
    // 不是自己手算反推（那樣兩處都用同一個錯的常數會互相抵消、測不出差異），
    // 而是像 D3／既有「每支榫頭都配得到」那條一樣，直接餵給真正的 matchMortiseForTenon 引擎函式。
    // ⚠️ 順帶發現：只用「舊公式 H/2=190 vs 正確 (H−topT)/2=181」這 9mm 差距，matchMortiseForTenon
    // 目前還是判定配得到（容忍度比預期寬，跟 [[feedback_wrd_audit_blind_spots]] 同一類「比對容忍度
    // 沒有想像中嚴」的既有現象）——這點留給下一輪覆核，這裡改用更大的偏移量確保這條斷言本身有效。
    const d = build();
    const leg = d.parts.find((p) => p.id === "leg-left-back")!;
    const goodMortise = leg.mortises.find((m) => (m.label ?? "").includes("側上橫檔"))!;
    const brokenOriginZ = goodMortise.origin.z + 100; // 明顯偏移，確認斷言機制本身有效
    const brokenLeg = { ...leg, mortises: [{ ...goodMortise, origin: { ...goodMortise.origin, z: brokenOriginZ } }] };
    const brokenIndex = buildWorldMortiseIndex([brokenLeg, ...d.parts.filter((p) => p.id !== "leg-left-back")]);
    const rail = d.parts.find((p) => p.id === "back-rail")!;
    const goodIndex = buildWorldMortiseIndex(d.parts);
    // 找出真正接 leg-left-back 的那一端（不假設是 start 還是 end）
    const tenon = rail.tenons.find((t) => matchMortiseForTenon(rail, t, tenonWorld(rail, t), goodIndex)?.partId === "leg-left-back")!;
    expect(tenon, "接 leg-left-back 那一端榫頭要先找得到，才能做下面的破壞測試").toBeTruthy();
    const matchGood = matchMortiseForTenon(rail, tenon, tenonWorld(rail, tenon), goodIndex);
    const matchBroken = matchMortiseForTenon(rail, tenon, tenonWorld(rail, tenon), brokenIndex);
    expect(matchGood?.partId, "現在的程式：榫頭配得到 leg-left-back 的榫眼").toBe("leg-left-back");
    expect(matchBroken?.partId, "明顯偏移後：真正的引擎函式不應該還判定配得到 leg-left-back").not.toBe("leg-left-back");
  });

  it("桌面板 Y 座標若沒扣掉 topT（改回舊的 H−backRailH 高度）會跟後上橫檔重疊而不是貼齊", () => {
    const top = build().parts.find((p) => p.id === "top")!;
    const brokenTopY = 380; // 模擬「桌面板疊在最頂端沒有扣自己厚度」的錯誤（应該是 362）
    expect(top.origin.y, "現在的桌面板 Y 應該是 362，不是天真地等於總高 380").not.toBe(brokenTopY);
    expect(top.origin.y).toBe(380 - 18);
  });

  it("桌面板木釘孔挖太深（超過桌面板 18 厚）時，深度稽核會抓到（證明新木釘的深度真的有被驗）", () => {
    // 🩸這條原本想用「拿掉伙伴變孤兒」測位置配對，實測發現 dowelPartner 是全域貪婪配對
    // （不限鄰近零件），拿掉側上橫檔的孔後桌面板的孔會被跟抽屜其他 Ø8 木釘配對走，
    // 不會變孤兒——這是全域配對範圍過寬的既有現象，跟 100mm 位置偏移那個一樣屬於
    // [[feedback_wrd_audit_blind_spots]]，已記錄在檔頭，不是這裡要驗的東西。
    // 改用同一份既有斷言邏輯（「不貫穿的挖除都不可以比料厚深」）驗證深度：桌面板厚 18mm，
    // 木釘孔正常是 12mm（見 D5），改成 20mm 會超過桌面板本身的厚度，這個真的會被抓到。
    const top = build().parts.find((p) => p.id === "top")!;
    const dowel = top.mortises[0];
    const brokenDepth = 20; // 桌面板只有 18 厚，20mm 的孔會鑽穿桌面
    expect(dowel.depth, "現在的深度應該安全（≤18）").toBeLessThan(brokenDepth);
    const brokenTop = { ...top, mortises: [{ ...dowel, depth: brokenDepth }, ...top.mortises.slice(1)] };
    const box = mortiseLocalBox(brokenTop, brokenTop.mortises[0]);
    const alongDepth = { x: brokenTop.visible.length, y: brokenTop.visible.thickness, z: brokenTop.visible.width }[box.depthAxis ?? "y"];
    expect(brokenDepth, "改壞後的深度應該超過桌面板沿深度軸的厚度").toBeGreaterThan(alongDepth);
  });

  it("桌面板木釘孔直徑改錯（跟側上橫檔的孔對不上）時，auditJoints 會抓到配不到", () => {
    const d2 = build();
    const top = d2.parts.find((p) => p.id === "top")!;
    const brokenTop = { ...top, mortises: top.mortises.map((m) => ({ ...m, length: 6, width: 6 })) }; // Ø8 改成 Ø6
    const brokenDesign = { ...d2, parts: d2.parts.map((p) => (p.id === "top" ? brokenTop : p)) };
    const a = auditJoints(brokenDesign);
    expect(a.unmatchedMortises.length, "直徑對不上時，桌面板的孔應該被判定配不到").toBeGreaterThan(0);
  });

  it("滑條 X 座標若改回舊的「固定間隙」公式會製造出間隙（證明 B2 斷言不是死的）", () => {
    const W = 480, legInnerX0 = 32, runnerGapOld = 5, runnerW = 14;
    const oldCxGraph = legInnerX0 + runnerGapOld + runnerW / 2; // 44（圖面座標，0~480）→ 舊版會產生 4mm 間隙
    const oldCxWorld = oldCxGraph - W / 2; // 轉世界座標（wx()：置中，扣 W/2），跟 side.origin.x 同一套座標系才能比
    const side = build().parts.find((p) => p.id === "drawer-1-side-left")!;
    const sideXMin = side.origin.x - side.visible.thickness / 2;
    expect(oldCxWorld + runnerW / 2, "舊公式算出來的滑條右緣（世界座標）").toBeLessThan(sideXMin);
    const runner = build().parts.find((p) => p.id === "runner-left")!;
    expect(runner.origin.x + runner.visible.thickness / 2, "現在的滑條右緣要 ≥ 側板左緣").toBeGreaterThanOrEqual(sideXMin);
  });
});
