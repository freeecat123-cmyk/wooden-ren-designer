/**
 * 木工工作桌模板 —— 期望值全部手算（不要把程式輸出貼回來）。
 * 跑法：npx vitest run lib/templates/__tests__/workbench.test.ts
 */
import { describe, it, expect } from "vitest";
import { workbench, workbenchOptions } from "../workbench";
import { auditJoints } from "@/lib/joinery/audit-joints";
import { mortiseLocalBox } from "@/lib/render/svg-views";
import { holeAxisOf, holeRadiusOf } from "@/lib/render/part-geometry";
import { applyEdgeProtection } from "@/lib/joinery/edge-protection";
import { WORKBENCH_PRESETS, WORKBENCH_PRESET_DEFAULTS, workbenchPresetValues } from "../workbench-presets";
import type { FurnitureDesign, MaterialId } from "@/lib/types";

type OptVal = string | number | boolean;
function build(options: Record<string, OptVal> = {}, size = { length: 1800, width: 600, height: 830 }): FurnitureDesign {
  return workbench({ ...size, material: "beech" as MaterialId, options });
}
/** 桌狗 / holdfast 孔（貫穿的）；桌底 Ø8 鉗座螺栓孔是盲孔，不算 */
const roundHoles = (d: FurnitureDesign, id: string) =>
  d.parts.find((p) => p.id === id)!.mortises.filter((m) => m.shape === "round" && m.cosmetic && m.through);

describe("木工工作桌：預設（厚板桌）", () => {
  const d = build();
  it("腳距桌端 = 桌長/5 → 腳中心 x = ±(900 − 360 − 50) = ±490", () => {
    const xs = d.parts.filter((p) => /^leg-\d$/.test(p.id)).map((p) => Math.abs(p.origin.x));
    expect(xs).toEqual([490, 490, 490, 490]);
  });
  it("桌面拉到全長 1800，前緣跟腳前面齊平（z = −300）", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.visible.length).toBe(1800);
    expect(top.origin.z - top.visible.width / 2).toBe(-300);
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    expect(leg.origin.z - leg.visible.width / 2).toBe(-300);
  });
  it("腳頂預設是暗榫（榫頭不露在工作面上）；鉗座 4 個 Ø8 螺栓孔在桌底", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    const legMortises = top.mortises.filter((m) => !m.cosmetic);
    expect(legMortises).toHaveLength(4);
    expect(top.mortises.filter((m) => m.label === "鉗座螺栓孔")).toHaveLength(4);
    const inner = d.parts.find((p) => p.id === "vise-inner-jaw")!;
    expect(inner.mortises).toHaveLength(3);
    expect(d.parts.find((p) => p.id === "vise-chop")!.mortises.some((m) => m.label === "鉗口桌狗孔")).toBe(true);
    // 2026-09-04 木頭仁裁示「接桌面預設不貫穿」：預設暗榫，榫眼不穿透桌面
    expect(legMortises.every((m) => m.through)).toBe(false);
    expect(d.parts.find((p) => p.id === "leg-1")!.tenons[0].type).not.toBe("through-tenon");
    // 明選貫穿還是要照做
    const th = build({ legTopJoint: "through" });
    expect(th.parts.find((p) => p.id === "top")!.mortises.filter((m) => !m.cosmetic).every((m) => m.through)).toBe(true);
    expect(th.parts.find((p) => p.id === "leg-1")!.tenons[0].type).toBe("through-tenon");
  });
  it("狗孔：從鉗口桌狗（木顎中心 750）起算整數孔距、跳過鉗本體上方 → 第一孔 750 − 200 = 550，每 100 到 −790 → 14 個；holdfast 後排 5 個", () => {
    const holes = roundHoles(d, "top");
    const front = holes.filter((m) => m.origin.z < 0);
    const rear = holes.filter((m) => m.origin.z > 0);
    expect(front).toHaveLength(14);
    expect(rear).toHaveLength(5);
    expect(Math.max(...front.map((m) => m.origin.x))).toBe(550);
    expect(Math.min(...front.map((m) => m.origin.x))).toBe(-750); // 750 − 15×100；−850 超過端頭留 100
    expect(front.every((m) => m.origin.z === -300 + 60 && m.length === 19 && m.through)).toBe(true);
    expect(rear.every((m) => m.origin.z === 300 - 100)).toBe(true);
  });
  it("7 吋鉗：木顎 180 寬、跟桌面齊平、本體是金屬不算材", () => {
    const chop = d.parts.find((p) => p.id === "vise-chop")!;
    expect(chop.visible.length).toBe(180);
    expect(chop.origin.y + chop.visible.thickness).toBe(830);
    expect(d.parts.find((p) => p.id === "vise-body")!.visual).toBe("metal");
    expect(d.parts.find((p) => p.id === "vise-spacer")).toBeUndefined(); // 75 ≥ 60 不用墊塊
  });
  it("合理輸入不亂噴警告", () => {
    expect(d.warnings ?? []).toEqual([]);
  });
});

describe("夾制要出聲", () => {
  it("桌面 40：holdfast 取消並出聲；⛔ 鉗只是示意，不准自動加墊塊改桌子", () => {
    const d = build({ topThickness: 40 });
    expect(roundHoles(d, "top").filter((m) => m.origin.z > 0)).toHaveLength(0);
    expect((d.warnings ?? []).join("\n")).toMatch(/holdfast/);
    // 2026-09-05 木頭仁裁示：虎鉗只是示意，不該反過來替使用者加料
    expect(d.parts.some((p) => p.id.includes("spacer"))).toBe(false);
    expect((d.warnings ?? []).join("\n")).not.toMatch(/墊塊/);
  });
  it("腳鉗會把 60 的腳提到 64 並出聲", () => {
    const d = build({ frontVise: "leg", legSize: 60 });
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(64);
    expect((d.warnings ?? []).join("\n")).toMatch(/64/);
  });
  it("格陣孔太多只畫前幾排並出聲（3000×1000 格陣：欄 floor(2880/96)+1=31、排 floor(880/96)+1=10 → 上限 200 → 6 排 186 孔）", () => {
    const d = build({ dogHoles: "grid", frontVise: "none" }, { length: 3000, width: 1000, height: 850 });
    const holes = roundHoles(d, "top");
    expect(holes.length).toBe(186);
    expect((d.warnings ?? []).join("\n")).toMatch(/只畫前 6 排/);
  });
  it("桌高偏離身高建議會出聲（170cm 手刨建議 833，設 700），文案帶「先做高 25mm」", () => {
    const d = build({}, { length: 1800, width: 600, height: 700 });
    expect((d.warnings ?? []).join("\n")).toMatch(/833/);
    expect((d.warnings ?? []).join("\n")).toMatch(/先做高 25mm/);
  });
});

describe("流派 preset 只蓋使用者沒動過的 key", () => {
  it("裙板桌：裙板 290×40、腳 75、暗榫、4 邊下橫撐、下層板、螺栓孔", () => {
    const d = build({ benchStyle: "apron" });
    const apron = d.parts.find((p) => p.id === "apron-front")!;
    expect(apron.visible.width).toBe(290);
    expect(apron.visible.thickness).toBe(40);
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(75);
    expect(d.parts.find((p) => p.id === "leg-1")!.tenons[0].type).toBe("blind-tenon");
    expect(d.parts.find((p) => p.id === "ls-front")).toBeDefined();
    expect(d.parts.find((p) => p.id === "under-shelf")).toBeDefined();
    // 每支腳 2 裙板 + 2 下橫撐 = 4 個榫眼 → 4 個螺栓孔（前腳另有 holdfast 孔列，不算）
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    expect(leg.mortises.filter((m) => m.label === "M10 床螺栓孔").length).toBe(4);
  });
  it("所見即所得：網址帶了 preset 管的 key 就照網址做（表單切流派時由 DesignFormShell 整組寫進網址）", () => {
    // 舊連結只有 benchStyle → 套一次 preset
    const legacy = build({ benchStyle: "apron" });
    expect(legacy.parts.find((p) => p.id === "apron-front")).toBeDefined();
    expect(legacy.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(75);
    // 表單寫過的網址：使用者把腳粗設 110、其他照 preset → 110 要留住
    const custom = build({ ...workbenchPresetValues("apron"), benchStyle: "apron", legSize: 110 });
    expect(custom.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(110);
    expect(custom.parts.find((p) => p.id === "apron-front")).toBeDefined();
    // 使用者在裙板桌底下把「前鉗」選回預設 quick、腳粗選回 100 → 就是 quick / 100，不會被 preset 吃掉
    const back = build({ ...workbenchPresetValues("mft"), benchStyle: "mft", frontVise: "quick", legSize: 100 });
    expect(back.parts.find((p) => p.id === "vise-chop")).toBeDefined();
    expect(back.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(100);
  });
  it("preset 表跟選項一致：每個 key 都存在、WORKBENCH_PRESET_DEFAULTS 等於 spec 預設", () => {
    const specByKey = new Map(workbenchOptions.map((s) => [s.key, s]));
    for (const [style, vals] of Object.entries(WORKBENCH_PRESETS)) for (const k of Object.keys(vals)) expect(specByKey.has(k), `${style}.${k}`).toBe(true);
    for (const [k, v] of Object.entries(WORKBENCH_PRESET_DEFAULTS)) expect(specByKey.get(k)?.defaultValue, k).toBe(v);
    // 每個 preset 帶的 key 都要在 DEFAULTS 裡（切回別的流派才回得去）
    for (const vals of Object.values(WORKBENCH_PRESETS)) for (const k of Object.keys(vals)) expect(k in WORKBENCH_PRESET_DEFAULTS, k).toBe(true);
  });
  it("工具槽桌：工作面 450、槽 150、整體置中在 600 深裡", () => {
    const d = build({ benchStyle: "well" });
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.visible.width).toBe(450);
    expect(top.origin.z - top.visible.width / 2).toBe(-300);
    const back = d.parts.find((p) => p.id === "well-back")!;
    expect(back.origin.z + back.visible.width / 2).toBe(300);
    expect(d.overall.width).toBe(600);
  });
  it("MFT：20mm 孔、96 間距、不裝鉗", () => {
    const d = build({ benchStyle: "mft" });
    const holes = roundHoles(d, "top");
    expect(holes.length).toBeGreaterThan(30);
    expect(holes.every((m) => m.length === 20)).toBe(true);
    const xs = [...new Set(holes.map((m) => m.origin.x))].sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBe(96);
    expect(d.parts.find((p) => p.id === "vise-chop")).toBeUndefined();
  });
});

describe("桌面中縫", () => {
  const d = build({ topSplit: "gap" });
  it("兩片各 (600−45)/2 = 277.5，擋條 45，腳頂榫眼各分到自己那片", () => {
    const f = d.parts.find((p) => p.id === "top-front")!;
    const b = d.parts.find((p) => p.id === "top-back")!;
    expect(f.visible.width).toBe(277.5);
    expect(b.visible.width).toBe(277.5);
    expect(d.parts.find((p) => p.id === "gap-stop")!.visible.width).toBe(45);
    expect(f.mortises.filter((m) => !m.cosmetic && m.length !== 64)).toHaveLength(2);
    expect(b.mortises.filter((m) => !m.cosmetic)).toHaveLength(2);
    expect(d.parts.find((p) => p.id === "top")).toBeUndefined();
  });
  it("買現成的東西不畫：沒有刨擋、桌上鉗、附件、滑塊狗頭零件", () => {
    const w = build({ topSplit: "gap", endVise: "wagon" });
    expect(w.parts.some((p) => /planing-stop|moxon|doe-foot|bench-hook|dog-block/.test(p.id))).toBe(false);
  });
});

describe("v2：尾鉗（wagon）", () => {
  const d = build({ endVise: "wagon" });
  it("尾鉗在前鉗另一端（−X）：那端懸出 470、另一端自動縮到 300 補腳距 → 腳架長 1030、腳中心 −380 / +550", () => {
    const xs = d.parts.filter((p) => /^leg-\d$/.test(p.id)).map((p) => p.origin.x).sort((a, b) => a - b);
    expect(xs).toEqual([-380, -380, 550, 550]);
    expect((d.warnings ?? []).join("\n")).not.toMatch(/腳距 \d+ 對桌高/);
  });
  it("桌面讓 100 給端蓋：長 1700、中心 +50；端蓋 100×600×75 在 −850；腳頂榫眼跟著腳（−425 / +495）", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.visible.length).toBe(1700);
    expect(top.origin.x).toBe(50);
    const cap = d.parts.find((p) => p.id === "end-cap")!;
    expect(cap.visible).toEqual({ length: 100, width: 600, thickness: 75 });
    expect(cap.origin.x).toBe(-850);
    const legM = top.mortises.filter((m) => !m.cosmetic).map((m) => m.origin.x).sort((a, b) => a - b);
    expect(legM).toEqual([-425, -425, 495, 495]);
  });
  it("槽 365×52 從端蓋內側面起算：中心 = −900 + 100 + 182.5 = −617.5（桌面 local −667.5），槽尾 −435 不碰前腳榫眼 −420", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    const slot = top.mortises.find((m) => m.length === 365)!;
    expect(slot.width).toBe(52);
    expect(slot.origin.x + top.origin.x).toBe(-617.5);
    expect(slot.through && slot.cosmetic).toBe(true);
    const front = top.mortises.filter((m) => m.shape === "round" && m.origin.z < 0).map((m) => m.origin.x + top.origin.x);
    expect(Math.min(...front)).toBeGreaterThanOrEqual(-617.5 + 182.5 + 60 - 0.5);
  });
  it("桌長 1500 不做尾鉗並出聲", () => {
    const s = build({ endVise: "wagon" }, { length: 1500, width: 600, height: 830 });
    expect(s.parts.find((p) => p.id === "end-cap")).toBeUndefined();
    expect((s.warnings ?? []).join("\n")).toMatch(/1800/);
  });
});

describe("v2：長板靠板 / 抽屜櫃 / 封邊板 / 雙面桌", () => {
  it("靠板：脊條在前橫撐頂（y=200）、軌在桌底 −25、滑板底 V 槽騎脊條（y=214）、頂槽咬上軌（頂 742）→ 高 528", () => {
    const d = build({ deadman: true, lowerStretcherArrangement: "box-frame" });
    const ridge = d.parts.find((p) => p.id === "deadman-ridge")!;
    const rail = d.parts.find((p) => p.id === "deadman-rail")!;
    const board = d.parts.find((p) => p.id === "deadman-board")!;
    expect(ridge.origin.y).toBe(200);
    expect(rail.origin.y).toBe(730);
    expect(board.visible.thickness).toBe(528);
    expect(board.origin.y).toBe(214);
    expect(board.mortises.filter((m) => m.shape === "round").length).toBe(5); // 60,160,260,360,460 ≤ 468
    expect(board.mortises.filter((m) => m.shape !== "round").map((m) => m.origin.y)).toEqual([0, 528]); // 底 V 槽、頂直槽
  });
  it("靠板前提不符（H 形沒有前橫撐）→ 不生、出聲", () => {
    const d = build({ deadman: true, lowerStretcherArrangement: "h-frame" });
    expect(d.parts.find((p) => p.id === "deadman-board")).toBeUndefined();
    expect((d.warnings ?? []).join("\n")).toMatch(/長板靠板已略過/);
  });
  it("抽屜櫃：坐在橫撐頂 y=200、櫃頂 755−210=545 → 高 345；寬 = 腳架 1080 − 2×100 − 6 = 874、深 = 600−100+50−34 = 516（面板留在腳前面後方）", () => {
    const d = build({ drawerCount: 2 });
    const cabTop = d.parts.find((p) => p.id === "drawer-cab-top")!;
    const bottom = d.parts.find((p) => p.id === "drawer-cab-bottom")!;
    expect(bottom.origin.y).toBe(200);
    expect(bottom.visible.length).toBe(874);
    expect(bottom.visible.width).toBe(516);
    expect(cabTop.origin.y + cabTop.visible.thickness).toBe(545);
    expect(d.parts.filter((p) => /drawer-cab-z1-drawer-\d-front$/.test(p.id)).length).toBe(2);
    expect(d.parts.find((p) => p.id === "under-shelf")).toBeUndefined();
  });
  it("裙板桌 + 抽屜：櫃頂躲到裙板底下（755−290−5 = 460）並出聲", () => {
    const d = build({ benchStyle: "apron", drawerCount: 2 });
    const cabTop = d.parts.find((p) => p.id === "drawer-cab-top")!;
    expect(cabTop.origin.y + cabTop.visible.thickness).toBe(470); // 桌面 65 → 腳高 765，裙板底 765−290−5
    expect((d.warnings ?? []).join("\n")).toMatch(/裙板/);
  });
  it("封邊板：桌面 1680、兩片 60 在 ±870；有尾鉗就略過", () => {
    const d = build({ breadboardEnds: true });
    expect(d.parts.find((p) => p.id === "top")!.visible.length).toBe(1680);
    expect(d.parts.find((p) => p.id === "breadboard-l")!.origin.x).toBe(870);
    const w = build({ breadboardEnds: true, endVise: "wagon" });
    expect(w.parts.find((p) => p.id === "breadboard-l")).toBeUndefined();
  });
  it("教室雙面桌：對側鉗在另一端後緣（x −750、chop z +315）、狗孔兩列、holdfast 在中央", () => {
    const d = build({ benchStyle: "classroom" });
    const chop2 = d.parts.find((p) => p.id === "vise2-chop")!;
    expect(chop2.origin.x).toBe(-750);
    expect(chop2.origin.z).toBe(300 + 20 + 22.5); // 後緣 + 內顎板 20 + 木顎 45/2
    const top = d.parts.find((p) => p.id === "top")!;
    const zs = new Set(top.mortises.filter((m) => m.shape === "round").map((m) => m.origin.z));
    expect(zs.has(-240) && zs.has(240) && zs.has(0)).toBe(true);
  });
  it("裙板桌前緣凸出 50：桌深 600 = 桌面總深（腳架 550）、整體置中 z 0、前緣 −300；狗孔離前緣 60 → 世界 z −240 = local −240", () => {
    // 09-04 全面檢查：凸出原本是「加在 W 外面」→ 桌面比外框深 50、三視圖外框漏掉前緣；改成從 W 扣（跟桌長 L 同一套語意）
    const d = build({ benchStyle: "apron" });
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.visible.width).toBe(600);
    expect(top.origin.z).toBe(0);
    expect(d.overall.width).toBe(600);
    const legs = d.parts.filter((p) => /^leg-\d$/.test(p.id));
    expect(new Set(legs.map((l) => l.origin.z))).toEqual(new Set([-212.5, 262.5])); // 腳架深 550、腳 75 → ±237.5，整體往後靠 25
    const front = top.mortises.filter((m) => m.shape === "round" && m.through && m.origin.z + top.origin.z < 0);
    expect(front.length).toBeGreaterThan(5);
    expect(front.every((m) => m.origin.z === -240)).toBe(true);
  });
  it("極端組合 400 深 + 150 腳 + 凸出 100：凸出收到 0，左右橫撐長度不會變 0", () => {
    const d = build({ frontOverhang: 100, legSize: 150, topSplit: "none" }, { length: 1800, width: 400, height: 830 });
    const ls = d.parts.find((p) => p.id === "ls-left")!;
    expect(ls.visible.length).toBeGreaterThan(50);
    expect(d.warnings?.some((w) => w.includes("前緣凸出 100"))).toBe(true);
  });
});

describe("專業做法：中央凹槽、前腳孔列", () => {
  it("中央凹槽 150：兩片各 225 寬、槽底板 24 厚頂面低 45、整片嵌在桌面厚度裡（沒有吊在桌底的墊條）", () => {
    const d = build({ topSplit: "center-well" });
    const f = d.parts.find((p) => p.id === "top-front")!;
    const b = d.parts.find((p) => p.id === "top-back")!;
    const tray = d.parts.find((p) => p.id === "center-well-bottom")!;
    expect(f.visible.width).toBe(225);
    expect(b.visible.width).toBe(225);
    // 2026-09-04 起兩端補 150 長的實木端塞（見下面那組測試），底板縮在兩端塞之間
    expect(tray.visible).toEqual({ length: 1800 - 2 * 150, width: 150, thickness: 24 });
    expect(tray.origin.y + 24).toBe(830 - 45);
    expect(tray.origin.y).toBeGreaterThanOrEqual(830 - 75); // 底板底面不低於桌面底面 → 不會撞裙板 / 穿帶
    expect(d.parts.some((p) => p.id.startsWith("center-well-cleat"))).toBe(false);
    expect(d.parts.find((p) => p.id === "gap-stop")).toBeUndefined();
  });
  it("中央凹槽 + 裙板桌（桌面 65）：槽深 45 收到 41（65 − 24）、底板底面 = 桌面底面", () => {
    const d = build({ benchStyle: "apron", topSplit: "center-well" });
    const tray = d.parts.find((p) => p.id === "center-well-bottom")!;
    expect(tray.origin.y).toBe(830 - 65);
    expect(d.warnings?.some((w) => w.includes("已收到 41"))).toBe(true);
  });
  it("中央凹槽 + 40 厚桌面（MFT）：放不下槽底板 → 改整片桌面並警告", () => {
    const d = build({ benchStyle: "mft", topSplit: "center-well" });
    expect(d.parts.find((p) => p.id === "center-well-bottom")).toBeUndefined();
    expect(d.parts.find((p) => p.id === "top")).toBeDefined();
    expect(d.warnings?.some((w) => w.includes("桌面至少 60"))).toBe(true);
  });
  it("前腳 holdfast 孔列預設開：兩支前腳各 3 個 Ø19，從腳頂下 120 到橫撐上 120 均分；後腳沒有", () => {
    const d = build();
    const front = d.parts.filter((p) => /^leg-\d$/.test(p.id) && p.origin.z < 0);
    const back = d.parts.filter((p) => /^leg-\d$/.test(p.id) && p.origin.z > 0);
    expect(front).toHaveLength(2);
    for (const leg of front) {
      const holes = leg.mortises.filter((m) => m.label === "前腳 holdfast 孔");
      expect(holes).toHaveLength(3);
      expect(Math.max(...holes.map((m) => m.origin.y))).toBe(755 - 120);
      expect(Math.min(...holes.map((m) => m.origin.y))).toBe(100 + 100 + 120);
      expect(holes.every((m) => m.length === 19 && m.through)).toBe(true);
    }
    expect(back.every((leg) => !leg.mortises.some((m) => m.label === "前腳 holdfast 孔"))).toBe(true);
    expect(build({ legHoles: false }).parts.find((p) => p.id === "leg-1")!.mortises.some((m) => m.label === "前腳 holdfast 孔")).toBe(false);
  });
});

describe("桌面底穿帶（騎在腳頂，2026-09-04 改）", () => {
  it("開：兩端各一條，寬＝腳粗、長度跟腳前後切齊（600）、坐在腳頂；腳短 30、腳頂榫長 30，總高不變", () => {
    const base = build();
    const d = build({ topBattens: true });
    const l = d.parts.find((p) => p.id === "top-batten-l")!;
    // 長 600 ＝ 兩支腳外緣到外緣（腳 z ±250、腳粗 100）→ 前後跟腳切齊，不再兩端各縮 20
    expect(l.visible).toEqual({ length: 600, width: 100, thickness: 30 }); // 寬 = legSize 100（腳頂榫 90 寬要穿過去）
    // 腳落在穿帶寬度正中間
    expect(l.origin.x).toBe(d.parts.find((p) => p.id === "leg-1")!.origin.x * -1);
    // 擺在腳的正上方（腳中心 x = ±490），不是以前的腳外側 ±580
    expect(l.origin.x).toBe(490);
    expect(d.parts.find((p) => p.id === "top-batten-r")!.origin.x).toBe(-490);
    // 頂面貼桌底（830 − 75 = 755）
    expect(l.origin.y + 30).toBe(755);
    // 腳短 30、腳頂榫長 30 → 總高不變
    const legBase = base.parts.find((p) => p.id === "leg-1")!;
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    expect(leg.visible.thickness).toBe(legBase.visible.thickness - 30);
    const tenon = leg.tenons.find((t) => t.position === "top")!;
    const tenonBase = legBase.tenons.find((t) => t.position === "top")!;
    expect(tenon.length).toBe(tenonBase.length + 30);
    expect(leg.visible.thickness + tenon.length).toBe(legBase.visible.thickness + tenonBase.length);
    // 穿帶上有兩顆貫穿榫眼給那一端的兩支腳
    expect(l.mortises.length).toBe(2);
    expect(l.mortises.every((m) => m.through && !m.cosmetic)).toBe(true);
    expect(d.notes).toMatch(/穿帶 100×30/);
    // 前緣凸出時前腳往後縮 → 長度要照實際腳位算，不是用桌深推
    const fo = build({ topBattens: true, frontOverhang: 50 });
    const fb = fo.parts.find((p) => p.id === "top-batten-l")!;
    const foLegs = fo.parts.filter((p) => /^leg-\d+$/.test(p.id) && Math.abs(p.origin.x - fb.origin.x) < 100);
    const lo = Math.min(...foLegs.map((p) => p.origin.z - p.visible.width / 2));
    const hi = Math.max(...foLegs.map((p) => p.origin.z + p.visible.width / 2));
    expect(fb.visible.length).toBe(hi - lo);
    expect(fb.origin.z).toBe((lo + hi) / 2);
    expect(build().parts.some((p) => p.id.startsWith("top-batten"))).toBe(false);
  });
  it("疊層桌面／有裙板／長板靠板都不做穿帶，而且要出聲說為什麼", () => {
    const cases: Record<string, OptVal>[] = [{ withApron: true }, { deadman: true, frontVise: "leg" }];
    for (const opt of cases) {
      const d = build({ topBattens: true, ...opt });
      expect(d.parts.some((p) => p.id.startsWith("top-batten"))).toBe(false);
      expect((d.warnings ?? []).join("\n")).toMatch(/穿帶已略過/);
    }
  });
});

describe("孔徑一個總開關", () => {
  it("選 20 → 狗孔、holdfast、前腳孔、靠板孔全是 Ø20；格陣桌用 19 也照設定", () => {
    const d = build({ dogHoleDia: "20", deadman: true });
    // 桌面狗孔／holdfast、前腳孔、靠板孔（鉗木顎上的螺桿孔 Ø30/Ø20 不算）
    const all = d.parts.filter((p) => /^(top|leg-\d|deadman-board)$/.test(p.id)).flatMap((p) => p.mortises).filter((m) => m.shape === "round" && m.through && m.cosmetic);
    expect(all.length).toBeGreaterThan(20);
    expect(all.every((m) => m.length === 20)).toBe(true);
    const g = build({ ...workbenchPresetValues("mft"), benchStyle: "mft", dogHoleDia: "19" });
    expect(roundHoles(g, "top").every((m) => m.length === 19)).toBe(true);
  });
});

describe("v2：純提示欄位", () => {
  it("出料台高於台面 → 危險警告；房間放不下 → 警告", () => {
    const a = build({ heightMode: "outfeed", sawTableHeightMm: 820 });
    expect((a.warnings ?? []).join("\n")).toMatch(/危險/);
    const r = build({ roomLengthCm: 200 });
    expect((r.warnings ?? []).join("\n")).toMatch(/放不下/);
  });
  it("桌面脹縮：櫸木 600 寬 → 600×0.119×0.2 = 14.3mm，選封邊板才警告長孔；預設不噴", () => {
    const b = build({ breadboardEnds: true });
    expect((b.warnings ?? []).join("\n")).toMatch(/14\.3mm/);
    expect((build().warnings ?? []).join("\n")).not.toMatch(/長孔/);
  });
});

describe("09-04 全面檢查修掉的（孔出界、裙板榫眼被橫撐排列拉走、料比腳粗、導件撞裙板）", () => {
  const within = (d: ReturnType<typeof build>) => {
    for (const p of d.parts) {
      if (!/^top(-front|-back)?$/.test(p.id)) continue;
      for (const m of p.mortises) {
        if (m.shape !== "round") continue;
        expect(Math.abs(m.origin.x)).toBeLessThanOrEqual(p.visible.length / 2 - m.length / 2);
      }
    }
  };
  it("MFT 格陣 + 尾鉗：桌面縮短 100 並平移後，格陣孔全部落在桌面片範圍內", () => {
    within(build({ benchStyle: "mft", endVise: "wagon" }));
  });
  it("雙面桌 + holdfast 後列 + 尾鉗略過：孔都在桌面內；尾鉗端 60 之內不打孔", () => {
    within(build({ doubleSided: true, holdfastHoles: true }));
    const d = build({ endVise: "wagon", holdfastHoles: true });
    within(d);
    const top = d.parts.find((p) => p.id === "top")!;
    const xs = top.mortises.filter((m) => m.shape === "round").map((m) => m.origin.x + top.origin.x);
    // 尾鉗在 −X 端：槽區 x < −(900 − 100 − 365 − 60) = −375 不能有孔
    expect(xs.every((x) => x >= -375.5)).toBe(true);
  });
  it("裙板桌改雙條（pair-x）：裙板榫眼留在裙板高度，不會被拉到橫撐高度", () => {
    const d = build({ ...workbenchPresetValues("apron"), benchStyle: "apron", lowerStretcherArrangement: "pair-x" });
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    const apron = d.parts.find((p) => p.id === "apron-front")!;
    const ys = leg.mortises.filter((m) => !m.cosmetic).map((m) => m.origin.y);
    const y0 = apron.origin.y, y1 = apron.origin.y + apron.visible.width; // 裙板佔的高度帶（兩面的榫眼上下錯開，各在帶內）
    expect(ys.filter((y) => y >= y0 && y <= y1).length).toBe(2); // 兩個面各一顆裙板榫眼（修前：0 顆，被拉到橫撐高度）
    expect(ys.filter((y) => y < 300).length).toBe(1); // 橫撐榫眼只剩 X 面那顆
  });
  it("H 形：左右橫撐上的中央橫撐榫眼在朝中心那一面（mesh-local y = 厚 / 0）、垂直置中", () => {
    const d = build({ lowerStretcherArrangement: "h-frame" });
    const l = d.parts.find((p) => p.id === "ls-left")!;
    const r = d.parts.find((p) => p.id === "ls-right")!;
    expect(l.mortises[0].origin).toEqual({ x: 0, y: 50, z: 0 });
    expect(r.mortises[0].origin).toEqual({ x: 0, y: 0, z: 0 });
  });
  it("下橫撐 80 厚配 60 腳：收到 40 並警告；裙板同理", () => {
    const d = build({ ...workbenchPresetValues("mft"), benchStyle: "mft", lowerStretcherThickness: 80, withApron: true, apronThickness: 60 });
    const ls = d.parts.find((p) => p.id === "ls-front")!;
    expect(ls.visible.thickness).toBe(40);
    const ap = d.parts.find((p) => p.id === "apron-front")!;
    expect(ap.visible.thickness).toBe(40);
    expect(d.warnings?.filter((w) => w.includes("太厚")).length).toBe(2);
  });
  it("腳鉗 + 裙板 340 寬 + 橫撐離地 150：平行導件從 290 壓低到 265（裙板底下 80），槽頂 305 不進裙板", () => {
    const d = build({ frontVise: "leg", withApron: true, apronWidth: 340, lowerStretcherHeight: 150 }, { length: 1800, width: 600, height: 760 });
    const legHeight = 760 - 75; // 685
    const slot = d.parts.flatMap((p) => p.mortises).find((m) => m.label === "平行導件槽")!;
    expect(slot).toBeDefined();
    expect(slot.origin.y).toBe(265 + 20);
    expect(slot.origin.y + 20).toBeLessThanOrEqual(legHeight - 340 - 40);
    expect(d.warnings?.some((w) => w.includes("壓低"))).toBe(true);
  });
});

describe("09-04 視覺審查修掉的（尾鉗槽切進腳榫眼、疊層料單、腳鉗三件對不上、穿帶／封邊板沒槽）", () => {
  it("疊層只存在夾板版：料單 / 裁切拆的是厚度（3 × 18），實木沒有這個做法", () => {
    const d = build({ materialStyle: "plywood" });
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.panelPieces).toBe(3);
    expect(top.panelSplit).toBe("thickness");
    // ⛔ 實木沒有疊層：選項裡沒有這個值，舊網址帶 stack 也要收回寬板平拼
    const spec = workbenchOptions.find((o) => o.key === "topBuild")!;
    const values = spec.type === "select" ? spec.choices.map((c) => c.value) : [];
    expect(values).toEqual(["plank", "stave"]);
    expect(workbenchOptions.some((o) => o.key === "topLayers")).toBe(false);
    const legacy = build({ topBuild: "stack" }).parts.find((p) => p.id === "top")!;
    expect(legacy.panelSplit).toBeUndefined();
    expect(legacy.panelPieces).toBe(3); // 600 / 280 → 3 片寬板平拼
  });
  it("腳鉗：導件榫長 = 腳 100 + 木顎 40，木顎背面有 40×25 榫眼、頂有狗孔；那支腳的 holdfast 孔避開螺桿孔 ±60", () => {
    const d = build({ frontVise: "leg" });
    const guide = d.parts.find((p) => p.id === "leg-vise-guide")!;
    expect(guide.visible.length).toBe(270);
    expect(guide.tenons[0].length).toBe(140);
    const chop = d.parts.find((p) => p.id === "leg-vise-chop")!;
    expect(chop.mortises.some((m) => m.length === 40 && m.width === 25 && m.depth === 40)).toBe(true);
    expect(chop.mortises.some((m) => m.shape === "round" && m.length === 19 && !m.through)).toBe(true);
    const legs = d.parts.filter((p) => /^leg-\d$/.test(p.id));
    const viseLeg = legs.find((l) => l.mortises.some((m) => m.shape === "round" && m.length === 32))!;
    const screwY = viseLeg.mortises.find((m) => m.shape === "round" && m.length === 32)!.origin.y;
    for (const m of viseLeg.mortises.filter((m) => m.label === "前腳 holdfast 孔")) expect(Math.abs(m.origin.y - screwY)).toBeGreaterThanOrEqual(60);
    // 導件榫：先穿腳的通槽、再進木顎盲榫眼 → audit-joints 的穿越規則要全部對上
    const ja = auditJoints(applyEdgeProtection(d));
    expect(ja.unmatchedTenons).toEqual([]);
    expect(ja.unmatchedMortises).toEqual([]);
  });
  it("穿帶：懸出只有 10 也放得下（騎在腳頂就不必跟鉗本體搶桌底那一段），兩端都做、都在桌面內", () => {
    const d = build({ topBattens: true, endOverhang: 10 });
    const bs = d.parts.filter((p) => p.id.startsWith("top-batten"));
    expect(bs.length).toBe(2);
    // 腳中心 x = ±(1800/2 − 10 − 100/2) = ±840，穿帶就在腳正上方且沒跑到桌面外
    for (const b of bs) {
      expect(Math.abs(b.origin.x)).toBe(840);
      expect(Math.abs(b.origin.x) + b.visible.width / 2).toBeLessThanOrEqual(900);
    }
    // 沒做穿帶的設計不准偷改腳長
    const noBatten = build({ endOverhang: 10 });
    expect(noBatten.parts.some((p) => p.id.startsWith("top-batten"))).toBe(false);
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.thickness)
      .toBe(noBatten.parts.find((p) => p.id === "leg-1")!.visible.thickness - 30);
  });
  it("腳鉗導件行程受桌深限制：500 深 + 150 腳 → 導件不撞後腳", () => {
    const d = build({ frontVise: "leg", legSize: 150 }, { length: 1800, width: 500, height: 830 });
    const guide = d.parts.find((p) => p.id === "leg-vise-guide")!;
    expect(guide.visible.length).toBe(120 + Math.max(40, 500 - 300 - 20 - 120));
  });
  it("穿帶改騎腳頂後桌底不再開燕尾槽；封邊板朝桌面那面仍有 12×30 舌槽", () => {
    const d = build({ topBattens: true, breadboardEnds: true });
    const top = d.parts.find((p) => p.id === "top")!;
    // 舊做法在桌底批 40 寬 15 深的燕尾槽；現在穿帶被腳頂榫貫穿，不需要也不該再開槽
    expect(top.mortises.filter((m) => m.shape !== "round" && m.depth === 15 && m.length === 40).length).toBe(0);
    const bb = d.parts.find((p) => p.id === "breadboard-l")!;
    expect(bb.mortises[0]).toMatchObject({ origin: { x: 0, y: 37.5, z: -30 }, depth: 30, width: 12 });
  });
});

describe("夾板疊層（materialStyle = plywood，§AU23）", () => {
  const ply = (o: Record<string, OptVal> = {}) => build({ materialStyle: "plywood", ...o });
  it("預設 3 層桌面 = 54、4 層腳 = 72 方、橫撐 2 層 = 36；桌面層數列進料單", () => {
    const d = ply();
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.visible.thickness).toBe(54);
    expect(top.panelPieces).toBe(3);
    expect(top.panelSplit).toBe("thickness");
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    expect(leg.visible.length).toBe(72);
    expect(leg.visible.width).toBe(72);
    expect(leg.panelPieces).toBe(4);
    expect(leg.visible.thickness).toBe(830 - 54); // 腳高 = 桌高 − 桌面厚
    const ls = d.parts.find((p) => p.id === "ls-front")!;
    expect(ls.visible.thickness).toBe(36);
    expect(ls.panelPieces).toBe(2);
  });
  it("層數選項會動：桌面 2/4 層 = 36/72，腳 3/5 層 = 54/90", () => {
    expect(ply({ plyTopLayers: "2" }).parts.find((p) => p.id === "top")!.visible.thickness).toBe(36);
    expect(ply({ plyTopLayers: "4" }).parts.find((p) => p.id === "top")!.visible.thickness).toBe(72);
    expect(ply({ legLayers: "3" }).parts.find((p) => p.id === "leg-1")!.visible.length).toBe(54);
    expect(ply({ legLayers: "5" }).parts.find((p) => p.id === "leg-1")!.visible.length).toBe(90);
  });
  it("整台沒有任何榫頭；腳上的接合榫眼變成 cosmetic 搭接槽", () => {
    const d = ply({ withApron: true });
    expect(d.parts.every((p) => (p.tenons?.length ?? 0) === 0)).toBe(true);
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    const notches = leg.mortises.filter((m) => m.shape !== "round");
    expect(notches.length).toBeGreaterThan(0);
    expect(notches.every((m) => m.cosmetic && !m.through)).toBe(true);
    expect(notches.every((m) => (m.label ?? "").includes("搭接槽"))).toBe(true);
  });
  it("搭接槽深：72 腳兩向各 18（一層）；54 腳兩向各 (54 − 36) / 2 = 9", () => {
    const deep = (o: Record<string, OptVal>) => {
      const leg = ply(o).parts.find((p) => p.id === "leg-1")!;
      return leg.mortises.filter((m) => m.shape !== "round").map((m) => m.depth);
    };
    expect(deep({}).every((v) => v === 18)).toBe(true);
    expect(deep({ legLayers: "3" }).every((v) => v === 9)).toBe(true);
  });
  it("橫撐的可見長（＝實際切料長）要伸進兩端的槽裡：前後撐 = 淨距 + 2 × 槽深", () => {
    const solid = build();
    // 腳距桌端 = 1800/5 = 360，腳中心 x = ±(900 − 360 − 72/2) = ±504
    const clear = 2 * 504 - 72; // 72 方腳的內側淨距 = 936
    const d = ply();
    expect(d.parts.find((p) => p.id === "ls-front")!.visible.length).toBe(clear + 2 * 18);
    // 實木版同一位置是「淨距 + 兩端榫長」，兩者不該相等（證明這條有真的改）
    expect(solid.parts.find((p) => p.id === "ls-front")!.visible.length).not.toBe(clear + 2 * 18);
  });
  it("腳鉗要 ≥64 厚的腳：3 層（54）自動提到 4 層（72）並出聲", () => {
    const d = ply({ frontVise: "leg", legLayers: "3" });
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(72);
    expect(d.warnings?.some((w) => w.includes("夾板腳已從 3 層提到 4 層"))).toBe(true);
  });
  it("骨架件改夾板計價，外購五金不受影響", () => {
    const d = ply({ endVise: "wagon" });
    for (const id of ["top", "leg-1", "ls-front"]) {
      expect(d.parts.find((p) => p.id === id)!.materialOverride).toBe("plywood");
    }
    expect(d.parts.filter((p) => p.visual === "metal").every((p) => !p.materialOverride)).toBe(true);
  });
  it("說明要給 4×8 呎張數與三種螺絲數（初學者照著買）", () => {
    const notes = String(ply().notes);
    expect(notes).toMatch(/18mm 4×8 呎（1220×2440）約 \d+ 張/);
    expect(notes).toMatch(/4×40 皿頭木螺絲約 \d+ 支/);
    expect(notes).toMatch(/搭接槽 6×80 螺絲 \d+ 支/);
    expect(notes).toMatch(/口袋孔螺絲 6×63 \d+ 支/);
  });
  it("疊層桌面不做穿帶／封邊板（沒地方批燕尾），並出聲", () => {
    const d = ply({ topBattens: true, breadboardEnds: true });
    expect(d.parts.some((p) => p.id.startsWith("batten"))).toBe(false);
    expect(d.parts.some((p) => p.id.startsWith("breadboard"))).toBe(false);
    expect(d.warnings?.some((w) => w.includes("穿帶已略過"))).toBe(true);
  });
  it("實木（預設）完全不受影響：腳粗滑桿照舊生效、榫頭還在", () => {
    const d = build({ legSize: 110 });
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(110);
    expect(d.parts.find((p) => p.id === "ls-front")!.tenons.length).toBe(2);
  });
  it("⛔ 回歸：MFT 流派不准預選夾板（會把使用者填的腳粗／橫撐厚吃掉）", () => {
    expect(WORKBENCH_PRESETS.mft.materialStyle).toBeUndefined();
    expect(WORKBENCH_PRESET_DEFAULTS.materialStyle).toBe("solid");
  });
});

describe("09-04 木頭仁看 3D 回報的三條（孔軸、中縫、中央槽端）", () => {
  it("圓孔的孔軸＝半徑最大那軸：桌面狗孔在 Y、前腳 holdfast 與靠板孔在 Z", () => {
    const d = build({ deadman: true });
    const boxOf = (id: string) => {
      const p = d.parts.find((x) => x.id === id)!;
      const m = p.mortises.find((mm) => mm.shape === "round")!;
      return mortiseLocalBox(p, m);
    };
    const top = boxOf("top");
    expect(holeAxisOf(top.hx, top.hy, top.hz)).toBe("y");
    expect(holeRadiusOf(top.hx, top.hy, top.hz)).toBe(9.5); // Ø19
    const leg = boxOf("leg-1");
    expect(holeAxisOf(leg.hx, leg.hy, leg.hz)).toBe("z");
    expect(holeRadiusOf(leg.hx, leg.hy, leg.hz)).toBe(9.5);
    const dm = boxOf("deadman-board");
    expect(holeAxisOf(dm.hx, dm.hy, dm.hz)).toBe("z");
    expect(holeRadiusOf(dm.hx, dm.hy, dm.hz)).toBe(9.5);
  });
  it("前腳有 holdfast 孔列、後腳沒有（legHoles 預設開）", () => {
    const d = build();
    const rounds = (id: string) => d.parts.find((p) => p.id === id)!.mortises.filter((m) => m.shape === "round").length;
    expect(rounds("leg-1")).toBeGreaterThan(0);
    expect(rounds("leg-2")).toBeGreaterThan(0);
    expect(rounds("leg-3")).toBe(0);
    expect(rounds("leg-4")).toBe(0);
    expect(build({ legHoles: false }).parts.find((p) => p.id === "leg-1")!.mortises.filter((m) => m.shape === "round").length).toBe(0);
  });
  it("中縫擋條是一小塊、不把縫塞滿（夾具要伸得進去），且擺在鉗那一端", () => {
    const d = build({ topSplit: "gap" });
    const stop = d.parts.find((p) => p.id === "gap-stop")!;
    const top = d.parts.find((p) => p.id === "top-front")!;
    expect(stop.visible.length).toBeLessThan(top.visible.length / 2);
    expect(stop.visible.length).toBeGreaterThanOrEqual(200);
    expect(stop.visible.width).toBe(45); // 中縫寬預設
    // 鉗預設在左（世界 +X）
    expect(stop.origin.x).toBeGreaterThan(0);
    // 擋條兩端都還在桌面長度內
    expect(Math.abs(stop.origin.x) + stop.visible.length / 2).toBeLessThanOrEqual(top.visible.length / 2);
  });
  it("中央凹槽兩端要補實木端塞（跟桌面同厚齊平），槽底板縮在兩端塞之間", () => {
    const d = build({ topSplit: "center-well" });
    const top = d.parts.find((p) => p.id === "top-front")!;
    const ends = d.parts.filter((p) => p.id.startsWith("center-well-end-"));
    expect(ends.length).toBe(2);
    for (const e of ends) {
      expect(e.visible.thickness).toBe(top.visible.thickness); // 同厚
      expect(e.origin.y).toBe(top.origin.y);                   // 齊平
      expect(e.visible.width).toBe(600 - 2 * top.visible.width); // 塞滿槽寬
      expect(Math.abs(e.origin.x) + e.visible.length / 2).toBeCloseTo(top.visible.length / 2, 6);
    }
    const tray = d.parts.find((p) => p.id === "center-well-bottom")!;
    expect(tray.visible.length).toBe(top.visible.length - ends[0].visible.length - ends[1].visible.length);
  });
});

describe("桌下抽屜：橫向分格（2026-09-04 加）", () => {
  it("2 層 × 2 格 ＝ 4 個抽屜面板，而且會多出分隔板", () => {
    const one = build({ drawerCount: 2, drawerCols: 1 });
    const two = build({ drawerCount: 2, drawerCols: 2 });
    const faces = (d: FurnitureDesign) => d.parts.filter((p) => /^drawer-cab-.*(front|face)/.test(p.id)).length;
    expect(faces(two)).toBe(2 * faces(one));
    expect(two.parts.length).toBeGreaterThan(one.parts.length);
  });
  it("預設 1 格（不動舊設計）；沒有抽屜時分格數不生效", () => {
    const d = build({ drawerCount: 2 });
    const one = build({ drawerCount: 2, drawerCols: 1 });
    expect(d.parts.map((p) => p.id)).toEqual(one.parts.map((p) => p.id));
    expect(build({ drawerCount: 0, drawerCols: 3 }).parts.some((p) => p.id.startsWith("drawer-cab"))).toBe(false);
  });
  it("櫃子太窄時每格會不到 180mm（手伸不進去）→ 自動收格數並出聲", () => {
    // 短桌：抽屜櫃夾在兩支腳之間，寬度不夠切 3 格
    const d = build({ drawerCount: 1, drawerCols: 3 }, { length: 900, width: 600, height: 830 });
    expect((d.warnings ?? []).some((w) => w.includes("手伸不進去"))).toBe(true);
  });
});

describe("穿帶寬度／厚度可調（2026-09-04）", () => {
  it("填了就照填的做；厚多少腳就短多少、榫就長多少，總高永遠不變", () => {
    const d = build({ topBattens: true, battenWidth: 160, battenThickness: 45 });
    const b = d.parts.find((p) => p.id === "top-batten-l")!;
    expect(b.visible.width).toBe(160);
    expect(b.visible.thickness).toBe(45);
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    const tenon = leg.tenons.find((t) => t.position === "top")!;
    expect(leg.visible.thickness).toBe(830 - 75 - 45);
    // 腳 + 穿帶 + 桌面 = 總高（榫長不入帳，預設是暗榫不穿透桌面）
    expect(leg.visible.thickness + 45 + 75).toBe(830);
    // 榫要比沒穿帶時長 45（才穿得過穿帶）
    const noBatten = build();
    expect(tenon.length).toBe(noBatten.parts.find((p) => p.id === "leg-1")!.tenons.find((t) => t.position === "top")!.length + 45);
    // 腳落在穿帶寬度正中間
    expect(Math.abs(b.origin.x)).toBe(Math.abs(leg.origin.x));
  });
  it("填得比腳窄會自動加寬到腳粗並出聲（腳不能凸出穿帶）", () => {
    const d = build({ topBattens: true, battenWidth: 50 });
    expect(d.parts.find((p) => p.id === "top-batten-l")!.visible.width).toBe(100);
    expect((d.warnings ?? []).some((w) => w.includes("已加寬到 100"))).toBe(true);
  });
  it("沒開穿帶時這兩個值不影響任何零件", () => {
    const a = build({ battenWidth: 200, battenThickness: 60 });
    const b = build();
    expect(a.parts.map((p) => `${p.id}:${p.visible.length}x${p.visible.width}x${p.visible.thickness}`))
      .toEqual(b.parts.map((p) => `${p.id}:${p.visible.length}x${p.visible.width}x${p.visible.thickness}`));
  });
});

describe("裙板榫眼不准在腳頂破口（2026-09-04）", () => {
  const legTop = (d: FurnitureDesign) => d.parts.find((p) => p.id === "leg-1")!;
  it("裙板頂跟腳頂齊平時，最上面那顆榫眼距腳頂要留 ≥25 實料", () => {
    for (const w of [150, 250, 340]) {
      const d = build({ withApron: true, apronWidth: w, legPenetratingTenon: true });
      const leg = legTop(d);
      const rect = leg.mortises.filter((m) => m.shape !== "round");
      const highest = Math.max(...rect.map((m) => m.origin.y + m.length / 2));
      expect(leg.visible.thickness - highest).toBeGreaterThanOrEqual(25);
    }
  });
  it("盲榫（沒勾通榫）也一樣不能破口", () => {
    const d = build({ withApron: true, apronWidth: 250, legPenetratingTenon: false });
    const leg = legTop(d);
    const rect = leg.mortises.filter((m) => m.shape !== "round");
    const highest = Math.max(...rect.map((m) => m.origin.y + m.length / 2));
    expect(leg.visible.thickness - highest).toBeGreaterThanOrEqual(25);
  });
});

describe("桌腳寬度／厚度分開設定（2026-09-04）", () => {
  it("腳厚 75：腳變 100×75、腳往外移、左右向的撐與裙板變長，前後向不動", () => {
    const sq = build({ withApron: true });
    const rect = build({ withApron: true, legDepth: 75 });
    const leg = rect.parts.find((p) => p.id === "leg-1")!;
    expect(leg.visible.length).toBe(100);
    expect(leg.visible.width).toBe(75);
    // 腳外緣還是貼齊桌深邊（600/2 = 300）
    expect(Math.abs(leg.origin.z) + 75 / 2).toBe(300);
    const len = (d: FurnitureDesign, id: string) => d.parts.find((p) => p.id === id)!.visible.length;
    // 左右向（沿桌深）淨距變大 50：兩支腳各往外移 12.5，腳本身又各薄 12.5
    expect(len(rect, "ls-left")).toBe(len(sq, "ls-left") + 50);
    expect(len(rect, "apron-left")).toBe(len(sq, "apron-left") + 50);
    // 前後向（沿桌長）不受影響
    expect(len(rect, "ls-front")).toBe(len(sq, "ls-front"));
    expect(len(rect, "apron-front")).toBe(len(sq, "apron-front"));
  });
  it("0 ＝ 方腳（跟不填一樣）；超出範圍會夾回並出聲", () => {
    const a = build({ legDepth: 0 });
    const b = build();
    expect(a.parts.map((p) => `${p.id}:${p.visible.width}`)).toEqual(b.parts.map((p) => `${p.id}:${p.visible.width}`));
    expect(build({ legDepth: 40 }).parts.find((p) => p.id === "leg-1")!.visible.width).toBe(60);
    expect((build({ legDepth: 40 }).warnings ?? []).some((w) => w.includes("腳厚 40 不合用"))).toBe(true);
    expect(build({ legDepth: 200 }).parts.find((p) => p.id === "leg-1")!.visible.width).toBe(100);
  });
  it("夾板疊層不給調腳厚（厚度一定是 18 的倍數）", () => {
    const d = build({ materialStyle: "plywood", legDepth: 75 });
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    expect(leg.visible.length).toBe(72);
    expect(leg.visible.width).toBe(72);
  });
});

describe("09-04 深夜第三輪：選了要有反應（靠板／穿帶／鉗位置／圖上分件線）", () => {
  it("長板靠板：桌端懸出不夠時自動拉到鉗裝得進腳外側，靠板一定做得出來", () => {
    for (const ov of [10, 100, 170, 200]) {
      const d = build({ deadman: true, endOverhang: ov });
      expect(d.parts.filter((p) => p.id.startsWith("deadman")).length).toBe(3);
      expect((d.warnings ?? []).some((w) => w.includes("桌端懸出已從"))).toBe(true);
    }
    // 本來就夠就不要亂動
    const ok = build({ deadman: true, endOverhang: 300 });
    expect((ok.warnings ?? []).some((w) => w.includes("桌端懸出已從"))).toBe(false);
  });
  it("前鉗位置可調：兩段可行區間（腳外側／腳內側），越界吸到最近的並出聲", () => {
    const chopX = (o: Record<string, OptVal>) => build(o).parts.find((p) => p.id === "vise-chop")!.origin.x;
    const auto = chopX({});
    expect(chopX({ viseInset: 150 })).toBe(auto);          // 自動值就是 150
    expect(chopX({ viseInset: 110 })).toBe(900 - 110);      // 腳外側最靠桌端
    expect(chopX({ viseInset: 600 })).toBe(900 - 600);      // 腳內側
    const bad = build({ viseInset: 400 });                  // 落在腳身上
    expect(bad.parts.find((p) => p.id === "vise-chop")!.origin.x).toBe(900 - 260);
    expect((bad.warnings ?? []).some((w) => w.includes("會壓到腳"))).toBe(true);
  });
  it("有裙板／長板靠板時穿帶選項不該出現（勾了也做不出來）", () => {
    const spec = workbenchOptions.find((o) => o.key === "topBattens")!;
    const conds = JSON.stringify(spec.dependsOn);
    expect(conds).toContain("withApron");
    expect(conds).toContain("deadman");
  });
});
