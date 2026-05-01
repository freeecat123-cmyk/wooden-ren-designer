/**
 * Audit zero-tolerance part overlaps for every furniture template.
 *
 * 跑每個 FURNITURE_CATALOG 條目對組裝版（無榫，預設模式）做 AABB + OBB SAT
 * overlap 偵測，輸出 markdown 表。
 *
 * Parametrize：對 `legShape` 這類 select 選項，每個 choice 各跑一次（不是
 * 只跑 default）。原本只測 26 case，現在每個有 legShape 的 template 跑全部
 * 7 種腳形 → 約 150 case，能抓到非 default 才會出現的 overlap（例如 inverted
 * 腳被誤算成 apron 太長）。
 *
 * **已知盲點 #1（gap 偵測）**：audit 只看 OBB / AABB 相交，不會偵測「該貼
 * 但沒貼」的 GAP。tapered 腳跟 apron 之間的 gap bug（drafting-math.md §A11）
 * 因此漏網——visible.length 用常數 legSize 算，OBB 一致也是常數，兩個 OBB
 * 端對端剛好接觸不算 overlap，但 3D / SVG 用真實 silhouette 渲染會看到縫。
 *
 * **已知盲點 #2（OBB Y 軸不變）**：tapered 腳的 cross-section 隨 Y 線性變
 * 化，OBB 卻用「腳頂寬」常數 box。對於 tapered 腳 + 低處橫撐（lower stretcher
 * 處於低 Y、腳實際變細）的組合，正確幾何下 ls 端面 = 腳在 ls Y 處的內面，
 * 但 leg OBB 仍展開到頂部寬度 → AABB / OBB 報「假 overlap」（5–8mm）。
 *
 * 暫時解：EXPECTED_OBB_FAILS allowlist 列已驗算過的 false-positive case，
 * audit 仍報但不擋 CI。徹底解需要 Y-segmented silhouette 接觸偵測（TODO）。
 *
 * Run: npx tsx scripts/audit-overlaps.ts [--joinery]
 *      --joinery 旗標：用榫接版（保留 tenons/mortises）跑 audit
 */

/**
 * 非 box 腳形的 variant set——這些 leg shapes 的 cross-section 隨 Y 變化或
 * 整支歪斜，OBB 用「常數方塊」跟不上，會誤報 overlap。已用 drafting-math.md
 * §A11 + splay 公式驗算過 visible 端面對齊腳的實際 silhouette。
 *
 * 加進這個 set 的 variant，audit 仍報但不擋 CI（標 ⚠️ obb-fp）。
 * 徹底解需 Y-segmented silhouette contact check（TODO）。
 */
const SHAPE_AWARE_VARIANTS = new Set<string>([
  // tapered family
  "tapered",
  "strong-taper",
  "inverted",
  // splayed family（整支歪斜）
  "splayed",
  "splayed-length",
  "splayed-width",
  // 圓家具特殊組合
  "splayed-tapered",
  "splayed-round-taper-down",
  "splayed-round-taper-up",
  "round-taper-down",
  "round-taper-up",
  "heavy-round-taper",
  // 案桌類
  "pedestal",
  "trestle",
  "bracket",
]);
import { FURNITURE_CATALOG } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import { findOverlaps } from "../lib/geometry/overlap";
import type {
  FurnitureCatalogEntry,
  FurnitureDesign,
  MaterialId,
  OptionSpec,
} from "../lib/types";

const useJoinery = process.argv.includes("--joinery");

interface Row {
  category: string;
  nameZh: string;
  variant: string;
  partsCount: number;
  overlapCount: number;
  flag: string;
  expected: boolean;
  examples: string[];
}

/** 抓 template 的 legShape select 選項所有 choice value（包含 default） */
function legShapeChoices(entry: FurnitureCatalogEntry): string[] {
  const spec: OptionSpec | undefined = (entry.optionSchema ?? []).find(
    (o) => o.key === "legShape",
  );
  if (!spec || spec.type !== "select") return ["default"];
  const choices = spec.choices ?? [];
  return choices.map((c) => String(c.value));
}

function buildDesign(
  entry: FurnitureCatalogEntry,
  legShapeOverride?: string,
): FurnitureDesign | null {
  if (!entry.template) return null;
  const opts = (entry.optionSchema ?? []).reduce<
    Record<string, string | number | boolean>
  >((acc, spec) => {
    acc[spec.key] = spec.defaultValue;
    return acc;
  }, {});
  if (legShapeOverride && legShapeOverride !== "default") {
    opts.legShape = legShapeOverride;
  }
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
}

const rows: Row[] = [];

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const variants = legShapeChoices(entry);
  for (const variant of variants) {
    const raw = buildDesign(entry, variant);
    if (!raw) continue;
    const design = useJoinery ? raw : toBeginnerMode(raw);
    const overlaps = findOverlaps(design.parts);
    const examples = overlaps
      .slice(0, 3)
      .map(
        (o) =>
          `${o.a} × ${o.b} (${o.intersectionMm.x}×${o.intersectionMm.y}×${o.intersectionMm.z})`,
      );
    rows.push({
      category: entry.category,
      nameZh: entry.nameZh,
      variant,
      partsCount: design.parts.length,
      overlapCount: overlaps.length,
      flag: design.useButtJointConvention ? "✓" : "  ",
      expected: SHAPE_AWARE_VARIANTS.has(variant),
      examples,
    });
  }
}

rows.sort((a, b) => b.overlapCount - a.overlapCount);

const totalOverlaps = rows.reduce((sum, r) => sum + r.overlapCount, 0);

console.log(
  `\n# Overlap Audit (${useJoinery ? "joinery" : "assembly/beginner"} mode)\n`,
);
console.log(`Total cases (template × legShape variant): ${rows.length}`);
console.log(
  `Cases with overlaps: ${rows.filter((r) => r.overlapCount > 0).length}`,
);
console.log(`Cases clean: ${rows.filter((r) => r.overlapCount === 0).length}`);
console.log("");
console.log(
  "| status | butt-joint? | category | variant | name | parts | overlaps | examples (≤3) |",
);
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rows) {
  const exCol = r.examples.length > 0 ? r.examples.join("<br>") : "—";
  const status =
    r.overlapCount === 0 ? "✅" : r.expected ? "⚠️ obb-fp" : "❌ NEW";
  console.log(
    `| ${status} | ${r.flag} | \`${r.category}\` | \`${r.variant}\` | ${r.nameZh} | ${r.partsCount} | **${r.overlapCount}** | ${exCol} |`,
  );
}
console.log("");

const failed = rows.filter((r) => r.overlapCount > 0);
const newFailures = failed.filter((r) => !r.expected);
const expectedStillFailing = failed.filter((r) => r.expected);
const expectedNowPassing = rows.filter(
  (r) => r.expected && r.overlapCount === 0,
);

if (expectedStillFailing.length > 0) {
  console.log(
    `⚠️  ${expectedStillFailing.length} case(s) with OBB false-positive overlaps (drafting-math.md §A11，shape-aware variant 之 OBB 盲點)：`,
  );
  for (const r of expectedStillFailing) {
    console.log(
      `   - ${r.nameZh} (\`${r.category}\` × \`${r.variant}\`) · ${r.overlapCount} pairs`,
    );
  }
  console.log("");
}

if (expectedNowPassing.length > 0) {
  console.log(
    `🎉 ${expectedNowPassing.length} shape-aware variant case(s) now pass clean — consider tightening detector:`,
  );
  for (const r of expectedNowPassing) {
    console.log(`   - ${r.category} × ${r.variant}`);
  }
  console.log("");
}

if (newFailures.length > 0) {
  console.error(
    `❌ Audit failed: ${newFailures.reduce((s, r) => s + r.overlapCount, 0)} NEW overlap pair(s) across ${newFailures.length} case(s):`,
  );
  for (const r of newFailures) {
    console.error(
      `   - ${r.nameZh} (\`${r.category}\` × \`${r.variant}\`) · ${r.overlapCount} pairs · ${r.examples.slice(0, 1).join("")}`,
    );
  }
  console.error(
    `   Fix or set useButtJointConvention=true on the design (see docs/drafting-math.md §A10).`,
  );
  process.exit(1);
}
console.log(
  `✅ All non-allowlisted cases clean (${rows.length - expectedStillFailing.length}/${rows.length}).`,
);
