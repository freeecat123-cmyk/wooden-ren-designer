/**
 * 木工工作桌模板 —— 期望值全部手算（不要把程式輸出貼回來）。
 * 跑法：npx vitest run lib/templates/__tests__/workbench.test.ts
 */
import { describe, it, expect } from "vitest";
import { workbench } from "../workbench";
import type { FurnitureDesign, MaterialId } from "@/lib/types";

type OptVal = string | number | boolean;
function build(options: Record<string, OptVal> = {}, size = { length: 1800, width: 600, height: 850 }): FurnitureDesign {
  return workbench({ ...size, material: "beech" as MaterialId, options });
}
const roundHoles = (d: FurnitureDesign, id: string) =>
  d.parts.find((p) => p.id === id)!.mortises.filter((m) => m.shape === "round" && m.cosmetic);

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
  it("腳頂是貫穿榫、桌面榫眼 through", () => {
    const top = d.parts.find((p) => p.id === "top")!;
    const legMortises = top.mortises.filter((m) => !m.cosmetic);
    expect(legMortises).toHaveLength(4);
    expect(legMortises.every((m) => m.through)).toBe(true);
    expect(d.parts.find((p) => p.id === "leg-1")!.tenons[0].type).toBe("through-tenon");
  });
  it("狗孔：鉗在左（+X）中心 750、第一孔 750 − (90+50) = 610，每 100 一個到 −800 → 15 個；holdfast 後排 5 個", () => {
    const holes = roundHoles(d, "top");
    const front = holes.filter((m) => m.origin.z < 0);
    const rear = holes.filter((m) => m.origin.z > 0);
    expect(front).toHaveLength(15);
    expect(rear).toHaveLength(5);
    expect(Math.max(...front.map((m) => m.origin.x))).toBe(610);
    expect(Math.min(...front.map((m) => m.origin.x))).toBe(-790);
    expect(front.every((m) => m.origin.z === -300 + 60 && m.length === 19 && m.through)).toBe(true);
    expect(rear.every((m) => m.origin.z === 300 - 100)).toBe(true);
  });
  it("7 吋鉗：木顎 180 寬、跟桌面齊平、本體是金屬不算材", () => {
    const chop = d.parts.find((p) => p.id === "vise-chop")!;
    expect(chop.visible.length).toBe(180);
    expect(chop.origin.y + chop.visible.thickness).toBe(850);
    expect(d.parts.find((p) => p.id === "vise-body")!.visual).toBe("metal");
    expect(d.parts.find((p) => p.id === "vise-spacer")).toBeUndefined(); // 75 ≥ 60 不用墊塊
  });
  it("合理輸入不亂噴警告", () => {
    expect(d.warnings ?? []).toEqual([]);
  });
});

describe("夾制要出聲", () => {
  it("桌面 40：holdfast 取消、鉗加 20 墊塊、刨擋偏薄，三條警告都在", () => {
    const d = build({ topThickness: 40, planingStop: true });
    expect(roundHoles(d, "top").filter((m) => m.origin.z > 0)).toHaveLength(0);
    const spacer = d.parts.find((p) => p.id === "vise-spacer")!;
    expect(spacer.visible.thickness).toBe(20);
    const w = (d.warnings ?? []).join("\n");
    expect(w).toMatch(/holdfast/);
    expect(w).toMatch(/墊塊/);
    expect(w).toMatch(/刨擋/);
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
  it("桌高偏離身高建議會出聲（170cm 手刨建議 833，設 700）", () => {
    const d = build({}, { length: 1800, width: 600, height: 700 });
    expect((d.warnings ?? []).join("\n")).toMatch(/833/);
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
    // 每支腳 2 裙板 + 2 下橫撐 = 4 個榫眼 → 4 個螺栓孔
    const leg = d.parts.find((p) => p.id === "leg-1")!;
    expect(leg.mortises.filter((m) => m.shape === "round").length).toBe(4);
  });
  it("裙板桌但使用者自己把腳粗設 110 → 保留 110（值等於預設 100 時才吃 preset 的 75）", () => {
    const d = build({ benchStyle: "apron", legSize: 110 });
    expect(d.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(110);
    // 模擬設計頁把所有 key 都寫進網址（全是預設值）→ preset 仍要套得上
    const all = build({ benchStyle: "apron", legSize: 100, withApron: false, topThickness: 75 });
    expect(all.parts.find((p) => p.id === "apron-front")).toBeDefined();
    expect(all.parts.find((p) => p.id === "leg-1")!.visible.length).toBe(75);
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

describe("桌面中縫 + 刨擋", () => {
  const d = build({ topSplit: "gap", planingStop: true });
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
  it("刨擋：64 方、露出 20、榫從柱底貫穿桌面、桌面有 64×64 通孔", () => {
    const stop = d.parts.find((p) => p.id === "planing-stop")!;
    expect(stop.visible).toEqual({ length: 64, width: 64, thickness: 20 });
    expect(stop.origin.y).toBe(850);
    expect(stop.tenons[0]).toMatchObject({ position: "bottom", type: "through-tenon", length: 75 });
    const f = d.parts.find((p) => p.id === "top-front")!;
    expect(f.mortises.some((m) => m.length === 64 && m.width === 64 && m.through && !m.cosmetic)).toBe(true);
  });
});
