/** 跑法:npx tsx lib/engineering-quote/adapters.test.ts */
import { computeFloorBom } from "../floor/calc";
import { FIXTURE_RECT } from "../floor/fixtures";
import { floorBomToEngInput } from "../floor/quote-adapter";
import { ENGINEERING_QUOTE_DEFAULTS as D } from "./defaults";

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
  assert(input.paintingPerPing === 0, "地板 paintingPerPing=0");
  assert(input.marginRate === D.marginRate, "套用預設毛利率");
}

console.log(`✅ adapters(floor): ${passed} passed`);
