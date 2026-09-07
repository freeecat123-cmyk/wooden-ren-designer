/**
 * 木釘做成零件（visual="dowel"）之後，組裝動畫要把它當接合：只能沿木釘軸向插入。
 * 🩸2026-09-07 丙級第一題：沒登記接合時背橫檔的 4 支木釘被當自由件「從上面掉下來」（from.y=140）。
 */
import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG } from "@/lib/templates";
import { planAssembly } from "@/lib/assembly/plan";

const entry = FURNITURE_CATALOG.find((e) => e.category === "cert-c1")!;
const build = () => entry.template!({ ...entry.defaults, material: "pine" });

describe("cert-c1 木釘的組裝方向", () => {
  it("8 支木釘都是 join、且只沿 x（木釘軸）進出", () => {
    const plan = planAssembly(build());
    const dowelMoves = plan.moves.filter((m) => m.partIds.some((id) => id.startsWith("dowel-")));
    expect(dowelMoves.length).toBeGreaterThan(0);
    const ids = new Set(dowelMoves.flatMap((m) => m.partIds.filter((id) => id.startsWith("dowel-"))));
    expect(ids.size).toBe(8);
    for (const m of dowelMoves) {
      expect(m.kind).toBe("join");
      expect(m.from.y).toBe(0);
      expect(m.from.z).toBe(0);
      expect(Math.abs(m.from.x)).toBeGreaterThan(0);
    }
  });
  it("拿掉 visual=dowel → 背橫檔木釘退回自由件從上方進場（證明是木釘規則在作用）", () => {
    const d = build();
    d.parts = d.parts.map((p) => (p.visual === "dowel" ? { ...p, visual: undefined } : p));
    const plan = planAssembly(d);
    const back = plan.moves.filter((m) => m.partIds.some((id) => /^dowel-.-back/.test(id)));
    expect(back.some((m) => m.from.y !== 0)).toBe(true);
  });
});
