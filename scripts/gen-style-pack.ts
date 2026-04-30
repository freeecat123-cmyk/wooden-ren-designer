/**
 * Generate style detail packs for a new furniture category.
 *
 * Run: npx tsx scripts/gen-style-pack.ts <category>
 *
 * 例：
 *   npx tsx scripts/gen-style-pack.ts wall-mounted-shelf
 *
 * 流程：
 * 1. 讀 lib/templates/<category>.ts 的 OptionSpec[]（含 min/max/choices）
 * 2. 對 8 風格各打一次 Claude API（用跟 /api/style-suggest 同款 SYSTEM_PROMPT）
 * 3. 產出 JSON 寫到 /tmp/style-pack-<category>.json
 * 4. 印出 paste-ready 段落讓使用者 merge 進 lib/knowledge/style-detail-packs.ts
 *
 * 需要 ANTHROPIC_API_KEY env var（local .env.local 或 export）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { FURNITURE_CATALOG } from "../lib/templates";
import type { FurnitureCategory, OptionSpec } from "../lib/types";

const STYLES = [
  "shaker",
  "mission",
  "midCentury",
  "ming",
  "windsor",
  "industrial",
  "japanese",
  "chippendale",
] as const;

const STYLE_HINTS: Record<string, string> = {
  shaker: "簡約宗教、櫻桃/楓木、through-tenon 加楔、無裝飾",
  mission: "粗料 quartersawn 橡木、through-tenon 露榫、cup pull",
  midCentury: "細腳 splayed 5°、teak/walnut、scooped 座面、bar pull",
  ming: "圓料、抱肩榫、座高 500、splat 中板靠背、束腰",
  windsor: "saddle 座、splay 10°、windsor spindle 圓棒椅背、milk paint",
  industrial: "粗料 50-60、box 直腳、無倒邊、bar pull、loft 工業",
  japanese: "細料 32-38、藏五金、finger-pull、桐簞笥、breadboard ends",
  chippendale: "粗料 45、寬牙條 90、splat 中板、ogee 線腳、bracket leg",
};

const SYSTEM_PROMPT = `你是台灣 woodworking YouTuber 木頭仁的家具設計助手。給你一個家具類別的 OptionSpec 跟一個風格，你要回該風格在這個家具上的 detail pack（10-25 個欄位）。

判斷原則：
1. 只用真實存在的 OptionSpec key（不發明）
2. 值符合 OptionSpec 的 min/max
3. select 型只用 choices 列出的 value（不寫 label）
4. 不確定就不寫該 key（讓 fallback 到 default）
5. 風格不適用該家具類別 → 整個 pack 回 null（例：Windsor 不做櫃類）

回傳純 JSON：
{ "<key>": <value>, "<key>": <value>, ... }

或是 null（風格不適用）。

不要 markdown code fence、不要解釋、只要 JSON。`;

async function genPackForStyle(
  client: Anthropic,
  category: string,
  optionSpec: OptionSpec[],
  styleId: string,
): Promise<Record<string, string | number | boolean> | null> {
  const userMsg = `家具類別：${category}
風格：${styleId}（${STYLE_HINTS[styleId] ?? ""}）

OptionSpec 全部欄位（每個含 key, type, label, defaultValue, min, max, choices）:
${JSON.stringify(optionSpec, null, 2)}

請回該風格的 detail pack（10-25 個 key），純 JSON。`;

  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const cleaned = text.replace(/^```json\n?|\n?```$/g, "").trim();
  if (cleaned === "null") return null;
  try {
    return JSON.parse(cleaned) as Record<string, string | number | boolean>;
  } catch (err) {
    console.error(`[${styleId}] JSON parse fail:`, cleaned.slice(0, 200));
    throw err;
  }
}

async function main() {
  const category = process.argv[2];
  if (!category) {
    console.error("Usage: npx tsx scripts/gen-style-pack.ts <category>");
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY env var.");
    process.exit(1);
  }

  // 從 catalog 找 template
  const entry = FURNITURE_CATALOG.find(
    (e) => e.category === (category as FurnitureCategory),
  );
  if (!entry) {
    console.error(`Category not in FURNITURE_CATALOG: ${category}`);
    console.error("Available:", FURNITURE_CATALOG.map((e) => e.category).join(", "));
    process.exit(1);
  }
  if (!entry.optionSchema) {
    console.error(`Category has no OptionSpec: ${category}`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const result: Record<string, Record<string, string | number | boolean> | null> = {};

  for (const styleId of STYLES) {
    process.stderr.write(`[${styleId}] 思考中...`);
    const start = Date.now();
    try {
      const pack = await genPackForStyle(client, category, entry.optionSchema, styleId);
      const dt = Date.now() - start;
      result[styleId] = pack;
      const keyCount = pack ? Object.keys(pack).length : 0;
      process.stderr.write(` ✓ ${keyCount} keys (${dt}ms)\n`);
    } catch (err) {
      process.stderr.write(` ✗ ${err}\n`);
      result[styleId] = null;
    }
  }

  const outPath = `/tmp/style-pack-${category}.json`;
  writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.error(`\n寫到 ${outPath}\n`);

  // 印 paste-ready 段（每個 style block 加新 category 鍵）
  console.log("\n# Paste-ready 段（merge 進 lib/knowledge/style-detail-packs.ts 各 style 物件下）：\n");
  for (const styleId of STYLES) {
    const pack = result[styleId];
    if (pack === null) {
      console.log(`# 在 STYLE_DETAIL_PACKS["${styleId}"] 加：`);
      console.log(`"${category}": null,\n`);
    } else if (pack) {
      console.log(`# 在 STYLE_DETAIL_PACKS["${styleId}"] 加：`);
      console.log(`"${category}": ${JSON.stringify(pack, null, 2).split("\n").join("\n")},\n`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
