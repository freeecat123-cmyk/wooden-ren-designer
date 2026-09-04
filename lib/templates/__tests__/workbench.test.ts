/**
 * 木工工作桌模板 —— 期望值全部手算（不要把程式輸出貼回來）。
 * 跑法：npx vitest run lib/templates/__tests__/workbench.test.ts
 */
import { describe, it, expect } from "vitest";
import { workbench, workbenchOptions } from "../workbench";
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
  it("腳頂是貫穿榫、桌面榫眼 through；鉗座 4 個 Ø8 螺栓孔在桌底", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    const legMortises = top.mortises.filter((m) => !m.cosmetic);
    expect(legMortises).toHaveLength(4);
    expect(top.mortises.filter((m) => m.label === "鉗座螺栓孔")).toHaveLength(4);
    const inner = d.parts.find((p) => p.id === "vise-inner-jaw")!;
    expect(inner.mortises).toHaveLength(3);
    expect(d.parts.find((p) => p.id === "vise-chop")!.mortises.some((m) => m.label === "鉗口桌狗孔")).toBe(true);
    expect(legMortises.every((m) => m.through)).toBe(true);
    expect(d.parts.find((p) => p.id === "leg-1")!.tenons[0].type).toBe("through-tenon");
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
  it("桌面 40：holdfast 取消、鉗加 20 墊塊，警告都在", () => {
    const d = build({ topThickness: 40 });
    expect(roundHoles(d, "top").filter((m) => m.origin.z > 0)).toHaveLength(0);
    const spacer = d.parts.find((p) => p.id === "vise-spacer")!;
    expect(spacer.visible.thickness).toBe(20);
    const w = (d.warnings ?? []).join("\n");
    expect(w).toMatch(/holdfast/);
    expect(w).toMatch(/墊塊/);
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
  it("槽 365×52 中心 = −900 + 100 + 30 + 182.5 = −587.5（桌面 local −637.5），狗孔停在槽前", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    const slot = top.mortises.find((m) => m.length === 365)!;
    expect(slot.width).toBe(52);
    expect(slot.origin.x + top.origin.x).toBe(-587.5);
    expect(slot.through && slot.cosmetic).toBe(true);
    const front = top.mortises.filter((m) => m.shape === "round" && m.origin.z < 0).map((m) => m.origin.x + top.origin.x);
    expect(Math.min(...front)).toBeGreaterThanOrEqual(-587.5 + 182.5 + 60 - 0.5);
  });
  it("桌長 1500 不做尾鉗並出聲", () => {
    const s = build({ endVise: "wagon" }, { length: 1500, width: 600, height: 830 });
    expect(s.parts.find((p) => p.id === "end-cap")).toBeUndefined();
    expect((s.warnings ?? []).join("\n")).toMatch(/1800/);
  });
});

describe("v2：長板靠板 / 抽屜櫃 / 封邊板 / 雙面桌", () => {
  it("靠板：脊條在前橫撐頂（y=200）、軌在桌底 −25、滑板高 = (755−25) − (225) − 2 = 503", () => {
    const d = build({ deadman: true, lowerStretcherArrangement: "box-frame" });
    const ridge = d.parts.find((p) => p.id === "deadman-ridge")!;
    const rail = d.parts.find((p) => p.id === "deadman-rail")!;
    const board = d.parts.find((p) => p.id === "deadman-board")!;
    expect(ridge.origin.y).toBe(200);
    expect(rail.origin.y).toBe(730);
    expect(board.visible.thickness).toBe(503);
    expect(board.origin.y).toBe(226);
    expect(board.mortises.length).toBe(4); // 60,160,260,360 ≤ 443
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
  it("裙板桌前緣凸出 50：桌面 650 寬、中心 z −25、前緣 −350；狗孔離新前緣 60 → 世界 z −290 = local −265", () => {
    const d = build({ benchStyle: "apron" });
    const top = d.parts.find((p) => p.id === "top")!;
    expect(top.visible.width).toBe(650);
    expect(top.origin.z).toBe(-25);
    const front = top.mortises.filter((m) => m.shape === "round" && m.through && m.origin.z + top.origin.z < 0);
    expect(front.length).toBeGreaterThan(5);
    expect(front.every((m) => m.origin.z === -265)).toBe(true);
  });
});

describe("專業做法：中央凹槽、前腳孔列", () => {
  it("中央凹槽 150：兩片各 225 寬、槽底板 24 厚頂面低 45、兩條墊條在槽底板下", () => {
    const d = build({ topSplit: "center-well" });
    const f = d.parts.find((p) => p.id === "top-front")!;
    const b = d.parts.find((p) => p.id === "top-back")!;
    const tray = d.parts.find((p) => p.id === "center-well-bottom")!;
    expect(f.visible.width).toBe(225);
    expect(b.visible.width).toBe(225);
    expect(tray.visible).toEqual({ length: 1800, width: 150, thickness: 24 });
    expect(tray.origin.y + 24).toBe(830 - 45);
    const cleat = d.parts.find((p) => p.id === "center-well-cleat-f")!;
    expect(cleat.origin.y + 20).toBe(tray.origin.y);
    expect(d.parts.find((p) => p.id === "gap-stop")).toBeUndefined();
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
