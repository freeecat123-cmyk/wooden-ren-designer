/** 跑法:npx tsx lib/engineering-quote/adapters.test.ts */
import { computeFloorBom } from "../floor/calc";
import { FIXTURE_RECT } from "../floor/fixtures";
import { floorBomToEngInput } from "../floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS as D } from "./defaults";
import { computeCeilingBom } from "../ceiling/calc";
import { DEFAULT_CEILING_INPUT } from "../ceiling/types";
import { ceilingBomToEngInput } from "../ceiling/quote-adapter";

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("❌ " + msg);
  passed++;
}

// 地板 adapter
{
  const bom = computeFloorBom(FIXTURE_RECT);
  const input = floorBomToEngInput(bom, D);
  assert(input.quoteType === "floor", "quoteType=floor");
  assert(input.pingShu === bom.auto.pingShu, "pingShu 帶入");
  assert(input.areaM2 === bom.auto.roomAreaM2, "areaM2 帶入");
  assert(input.materialCost === bom.cost.total, "materialCost=BOM total");
  assert(input.materialLines.length === bom.items.length, "每個 BOM 品項一行");
  assert(input.marginRate === D.marginRate, "套用預設毛利率");
  // 地板 adapter 必須「硬寫」paintingPerPing=0,即使 opts 給了非 0 值
  const inputWithPaint = floorBomToEngInput(bom, { ...D, paintingPerPing: 100 });
  assert(inputWithPaint.paintingPerPing === 0, "地板強制 paintingPerPing=0(不轉發 opts)");
  assert(
    input.materialLines.every((l) => l.unpriced),
    "零價 fixture → 所有材料行 unpriced",
  );
}

// 天花板 adapter
{
  const bom = computeCeilingBom(DEFAULT_CEILING_INPUT);
  const input = ceilingBomToEngInput(bom, 3000, D);
  assert(input.quoteType === "ceiling", "quoteType=ceiling");
  assert(input.pingShu === bom.auto.pingShu, "ceiling pingShu 帶入");
  assert(
    input.materialCost === Math.round(3000 * bom.auto.pingShu),
    `materialCost=每坪3000×${bom.auto.pingShu}=${input.materialCost}`,
  );
  assert(input.materialLines.length === 1, "天花板材料一行");
  assert(
    input.materialLines[0].detail !== undefined,
    "材料行 detail 附 BOM 數量摘要",
  );
  assert(
    input.materialLines[0].unpriced !== true,
    "天花板有材料價 → 材料行非 unpriced",
  );
}

console.log(`✅ adapters: ${passed} passed`);
