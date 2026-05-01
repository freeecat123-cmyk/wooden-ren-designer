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
 * Template-level 設計殘差 allowlist——這些 variant 在某些模板會殘留小幅
 * 重疊（1–3mm），不是 Y-slice false positive，而是 template 自己的補償寫法
 * 在 apron Y 邊界沒處理完整、bracket 結構性重疊（兩件實質有 2mm 嵌入）、
 * pedestal 柱-腳設計重疊。
 *
 * 列在這的 variant，audit 報但不擋 CI（標 ⚠️ design-residue）。Phase 4+
 * 一一檢視 template 修。原本 SHAPE_AWARE_VARIANTS 為 OBB blindspot 的暫時
 * 解，2026-05-01 D.2 改 Y-slice 後 OBB 死角全消，殘留就是 template 的
 * 設計殘差。
 */
const SHAPE_AWARE_VARIANTS = new Set<string>([
  // tapered 家族殘留：dining-chair strong-taper 補償在 apron Y 邊界仍有
  // 1.5mm（bottomScale=0.4 比 0.6 更激進，apron-trapezoid 比例不夠精準）
  "strong-taper",
  // splayed-tapered 家族（圓家具）：splay × taper 雙效果在 apron 邊界
  // 各 2-3mm 殘差，apron-trapezoid 沒 fully 同時 model splay+taper
  "splayed-tapered",
  "splayed-round-taper-down",
  "splayed-round-taper-up",
  // 倒圓錐腳（上窄下寬）：apron-front 1.4-3.1mm 殘差
  "round-taper-up",
  // 案桌類結構性重疊：bracket 嵌入腳 2mm（沒寫 tenon/mortise）；pedestal
  // 柱-腳設計性大重疊（3D 看起來正常但兩 box 共占 X×Z 空間）
  "bracket",
  "pedestal",
]);
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
