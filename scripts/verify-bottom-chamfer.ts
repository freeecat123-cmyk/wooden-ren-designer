/**
 * 驗證「下緣倒角」功能：option → Part.shape.bottomChamferMm 資料流 + 夾限。
 * Run: npx tsx scripts/verify-bottom-chamfer.ts
 */
import { FURNITURE_CATALOG } from "../lib/templates";

// catalog 用 `category` 當 key；方凳的 category 是 "stool"
const TARGETS = ["desk", "dining-chair", "stool", "bar-stool", "bench", "round-stool"];

function build(id: string, overrides: Record<string, string | number | boolean>) {
  const entry = FURNITURE_CATALOG.find((e) => (e as { category?: string }).category === id);
  if (!entry || !entry.template) throw new Error(`no template: ${id}`);
  const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
    (acc, spec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    },
    {},
  );
  Object.assign(opts, overrides);
  const design = entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as never,
    options: opts,
  });
  return design;
}

/** 找座板 / 桌面那塊 part：shape 是 chamfered-top 或 round 的那塊。 */
function seatPart(design: { parts: Array<{ id: string; nameZh: string; shape?: { kind: string; chamferMm?: number; bottomChamferMm?: number } }> }) {
  return design.parts.find(
    (p) => p.shape && (p.shape.kind === "chamfered-top" || p.shape.kind === "round"),
  );
}

let fail = 0;
function check(label: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "✅" : "❌"} ${label} — ${detail}`);
  if (!ok) fail++;
}

console.log("=== 下緣倒角資料流驗證 ===\n");

for (const id of TARGETS) {
  console.log(`■ ${id}`);

  // Case A: legInset 大、seatEdgeBottom 小於 inset → 不夾限，下緣倒角 = 14
  const legInsetBig = id === "bar-stool" ? 120 : id === "round-stool" ? 80 : 150;
  const a = build(id, { legInset: legInsetBig, seatEdge: 6, seatEdgeBottom: 14, seatEdgeStyle: "chamfered" });
  const sa = seatPart(a);
  const botA = sa?.shape?.bottomChamferMm;
  // round-stool 另夾 seatThickness*0.45（厚 25 → 11.25）
  const expectA = id === "round-stool" ? 11.25 : 14;
  check("Case A 下緣倒角值", botA === expectA, `bottomChamferMm=${botA} (期望 ${expectA}), part=${sa?.nameZh ?? "?"}/${sa?.shape?.kind}`);
  check("Case A 上緣倒角保留", (sa?.shape?.chamferMm ?? -1) === 6, `chamferMm=${sa?.shape?.chamferMm}`);

  // Case B: legInset 小、seatEdgeBottom 大 → 靜默夾限到 legInset
  const b = build(id, { legInset: 9, seatEdge: 0, seatEdgeBottom: 28, seatEdgeStyle: "chamfered" });
  const sb = seatPart(b);
  const botB = sb?.shape?.bottomChamferMm;
  // round-stool: min(28, 9, 11.25) = 9
  const expectB = 9;
  check("Case B 夾限到 legInset", botB === expectB, `seatEdgeBottom=28, legInset=9 → bottomChamferMm=${botB} (期望 ${expectB})`);

  // Case C: legInset = 0 → 夾限 min(_,0)=0 → 無下緣倒角
  // round-stool legInset 永遠 >0（min 20），跳過
  if (id !== "round-stool") {
    const c = build(id, { legInset: 0, seatEdge: 5, seatEdgeBottom: 20, seatEdgeStyle: "chamfered" });
    const sc = seatPart(c);
    const botC = sc?.shape?.bottomChamferMm;
    check("Case C legInset=0 無下緣倒角", botC === undefined, `bottomChamferMm=${botC} (期望 undefined)`);
  }

  console.log("");
}

console.log(fail === 0 ? "🎉 全部通過" : `❌ ${fail} 項失敗`);
process.exit(fail === 0 ? 0 : 1);
