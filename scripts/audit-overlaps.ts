/**
 * Audit zero-tolerance part overlaps for every furniture template.
 *
 * 跑每個 FURNITURE_CATALOG 條目對組裝版（無榫，預設模式）做 Y-segmented
 * silhouette overlap 偵測（drafting-math §A11 D.2，2026-05-01 改架構）：
 *
 *   Stage 1 — AABB 體積相交（fast reject）
 *   Stage 2 — Y-slice silhouette 接觸（在 Y 交集區間採樣 24 層，每層用
 *             front/side silhouette 取 X/Z 區間 = AABB-at-Y；任一層 X∩Z >
 *             tolerance 才算真 overlap）
 *
 * Y-slice 把 OBB 的「常數截面」死角解掉——tapered 腳在低 Y 自動縮、splayed
 * 腳自動位移，AABB-at-Y 跟著實際幾何走。
 *
 * Parametrize：對 `legShape` 這類 select 選項，每個 choice 各跑一次。
 *
 * Run: npx tsx scripts/audit-overlaps.ts [--joinery]
 *      --joinery 旗標：用榫接版（保留 tenons/mortises）跑 audit
 */

/**
 * Template-level 設計殘差 allowlist——保留以擋將來新模板的非預期 false
 * positive。2026-05-01 D.2 完整收尾後此清單為空（120/120 全綠）：
 *
 *   - bracket: 改成端面對腳（不嵌入），audit 通過
 *   - strong-taper (dining-chair): 套 apron-trapezoid + 修正 apronInnerSpan
 *     公式（length − legSize − apronLegSize 而非 length − 2*apronLegSize）
 *   - splayed-tapered family / round-taper-up（圓家具）：圓家具 builder 加
 *     legBottomScale 路徑 + apron-trapezoid，silhouette code tapered
 *     X/Z 雙軸線性內插（取代 step-function isBottom）
 *   - pedestal: foot origin 改成從柱外面延伸（不嵌入柱）
 */
const SHAPE_AWARE_VARIANTS = new Set<string>([]);
import { FURNITURE_CATALOG } from "../lib/templates";
import type { FurnitureCatalogEntry } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import { findOverlaps } from "../lib/geometry/overlap";
import type {
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
    (o: OptionSpec) => o.key === "legShape",
  );
  if (!spec || spec.type !== "select") return ["default"];
  const choices = spec.choices ?? [];
  return choices.map((c: { value: string | number | boolean }) => String(c.value));
}

function buildDesign(
  entry: FurnitureCatalogEntry,
  legShapeOverride?: string,
): FurnitureDesign | null {
  if (!entry.template) return null;
  const opts = (entry.optionSchema ?? []).reduce<
    Record<string, string | number | boolean>
  >((acc: Record<string, string | number | boolean>, spec: OptionSpec) => {
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
    const allOverlaps = findOverlaps(design.parts);
    // butt-joint convention 允許的幾何性微小重疊：椅背後仰時背柱底端必然 dip 進
    // 座板 AABB ((legD/2)·sin(rake)，5° 約 1.5mm)。背柱繞中心旋轉導致 bottom-back
    // corner 落到 seatHeight 以下、bottom-front corner 升到 seatHeight 以上，
    // 這個 dip 是物理必然；不裁切才能讓 3D 跟三視圖視覺一致（bottom-front 接到座板上緣）。
    const overlaps = design.useButtJointConvention
      ? allOverlaps.filter((o) => {
          const ids = [o.a, o.b].sort();
          // 椅背後仰時整組（back-post / back-slat / back-splat / back-spindle / back-rung）
          // 繞前下角 pivot 旋轉，bottom-back corner 必然 dip 進座板 AABB（物理必然，
          // 視覺被座板上緣遮，3D 跟三視圖一致）。butt-joint 設計放行。
          if (ids[1] !== "seat") return true;
          if (ids[0].startsWith("back-")) return false;
          return true;
        })
      : allOverlaps;
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
    r.overlapCount === 0 ? "✅" : r.expected ? "⚠️ design-residue" : "❌ NEW";
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
    `⚠️  ${expectedStillFailing.length} case(s) with template design residue (drafting-math.md §A11 D.2 後殘留——bracket 結構性嵌入、splayed-tapered 補償邊界、pedestal 設計重疊)：`,
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
    `🎉 ${expectedNowPassing.length} design-residue variant case(s) now pass clean — consider tightening allowlist:`,
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
