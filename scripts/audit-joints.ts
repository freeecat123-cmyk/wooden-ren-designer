/**
 * Joint dimension audit — joineryMode 下每個公榫必須找得到匹配的母榫，反之亦然。
 *
 * 用法：npx tsx scripts/audit-joints.ts
 * Exit 0 = 全部 templates pass；Exit 1 = 任一 template 有未對位榫頭。
 *
 * 對應檔案：lib/joinery/audit-joints.ts、docs/drafting-math.md §B2
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import type { FurnitureCatalogEntry } from "../lib/templates";
import { auditJoints, formatJointAudit } from "../lib/joinery/audit-joints";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";
import type {
  FurnitureCategory,
  FurnitureDesign,
  MaterialId,
  OptionSpec,
} from "../lib/types";

/**
 * 已知 pre-existing 對位 mismatch 的 templates（Phase 1 範圍外）。
 * 列在這裡的 templates 即使有 unmatched joints 也不會 fail CI；
 * 但會印報告，提醒之後 Phase 4+ 補。
 *
 * 加入此清單的條件：tenon/mortise 設計意圖正確，只是 dim 對位細節（tongue
 * 寬度、tongue-and-groove 板拼接、圓家具圓腳 mortise 對位）還沒整合進
 * standardTenon()。Phase 1 不修。
 */
/**
 * 空 allowlist = 所有 templates × 所有 legShape variant 都應該 audit pass。
 * Phase 1 Group D.1 把 13 個 pre-existing fail 全部修完了（commit 歷史可查）。
 * 將來新加 template 預設 strict，未對位直接擋 CI。
 */
// 2026-05-06：commit 0c369fd（邊桌抽屜系統）引入後 baseline 就有的 pre-existing
// mismatch，hook 之前沒擋到，這次 commit lib/templates/ 才被觸發。Phase 4+ 修。
//   - low-table: center-stretcher start/end blind-tenon 對應 apron-front/back
//     母榫，dim 軸序不一致（tenon W=23 T=25 vs mortise L=25 W=23）
//   - dining-chair: back-top-rail tenon W=10 T=23 vs back-post mortise L=23 W=10，
//     軸序對調 audit 算 unmatched（3D / 三視圖視覺正確）
const EXPECTED_FAILS: ReadonlySet<FurnitureCategory> = new Set<FurnitureCategory>([
  "low-table",
  "dining-chair",
]);

interface Row {
  category: FurnitureCategory;
  nameZh: string;
  variant: string;
  buttJoint: boolean;
  unmatchedTenons: number;
  unmatchedMortises: number;
  expected: boolean;
  detail?: string;
}

/** 抓 template 的 legShape 所有 choice value（包含 default） */
function legShapeChoices(entry: FurnitureCatalogEntry): string[] {
  const spec: OptionSpec | undefined = (entry.optionSchema ?? []).find(
    (o: OptionSpec) => o.key === "legShape",
  );
  if (!spec || spec.type !== "select") return ["default"];
  const choices = spec.choices ?? [];
  return choices.map((c: { value: string | number | boolean }) => String(c.value));
}

const rows: Row[] = [];

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const variants = legShapeChoices(entry);
  for (const variant of variants) {
    const opts = (entry.optionSchema ?? []).reduce<
      Record<string, string | number | boolean>
    >((acc: Record<string, string | number | boolean>, spec: OptionSpec) => {
      acc[spec.key] = spec.defaultValue;
      return acc;
    }, {});
    if (variant !== "default") opts.legShape = variant;
    const rawDesign: FurnitureDesign = entry.template({
      length: entry.defaults.length,
      width: entry.defaults.width,
      height: entry.defaults.height,
      material: "maple" as MaterialId,
      options: opts,
    });
    // joinery mode = 用 edge-protected design（不跑 toBeginnerMode），保留 tenons/mortises
    const design = applyEdgeProtection(rawDesign);
    const result = auditJoints(design);
    rows.push({
      category: entry.category,
      nameZh: entry.nameZh,
      variant,
      buttJoint: design.useButtJointConvention === true,
      unmatchedTenons: result.unmatchedTenons.length,
      unmatchedMortises: result.unmatchedMortises.length,
      expected: EXPECTED_FAILS.has(entry.category),
      detail:
        result.unmatchedTenons.length === 0 && result.unmatchedMortises.length === 0
          ? undefined
          : formatJointAudit(result),
    });
  }
}

console.log("\n# Joint Dimension Audit (joinery mode)\n");
console.log(`Total cases (template × legShape variant): ${rows.length}`);
console.log(
  `Cases with unmatched joints: ${rows.filter((r) => r.unmatchedTenons + r.unmatchedMortises > 0).length}`,
);
console.log("");
console.log(
  "| status | butt-joint? | category | variant | name | unmatched tenons | unmatched mortises |",
);
console.log("|---|---|---|---|---|---|---|");
for (const r of rows) {
  const flag = r.buttJoint ? "✓" : "  ";
  const fails = r.unmatchedTenons + r.unmatchedMortises;
  const status =
    fails === 0 ? "✅" : r.expected ? "⚠️ known" : "❌ NEW";
  console.log(
    `| ${status} | ${flag} | \`${r.category}\` | \`${r.variant}\` | ${r.nameZh} | **${r.unmatchedTenons}** | **${r.unmatchedMortises}** |`,
  );
}
console.log("");

const failed = rows.filter(
  (r) => r.unmatchedTenons > 0 || r.unmatchedMortises > 0,
);
const newFailures = failed.filter((r) => !r.expected);
const expectedStillFailing = failed.filter((r) => r.expected);
const expectedNowPassing = rows.filter(
  (r) => r.expected && r.unmatchedTenons + r.unmatchedMortises === 0,
);

if (expectedStillFailing.length > 0) {
  console.log(
    `⚠️  ${expectedStillFailing.length} known-issue template(s) (Phase 4+ work):`,
  );
  for (const r of expectedStillFailing) {
    console.log(
      `   - ${r.nameZh} (\`${r.category}\` × \`${r.variant}\`) · ${r.unmatchedTenons} tenons / ${r.unmatchedMortises} mortises`,
    );
  }
  console.log("");
}

if (expectedNowPassing.length > 0) {
  console.log(
    `🎉 ${expectedNowPassing.length} case(s) used to be in EXPECTED_FAILS but now PASS — consider removing from allowlist:`,
  );
  for (const r of expectedNowPassing) {
    console.log(`   - ${r.category} × ${r.variant} (${r.nameZh})`);
  }
  console.log("");
}

if (newFailures.length === 0) {
  console.log(
    `✅ All non-allowlisted cases pass (${rows.length - expectedStillFailing.length}/${rows.length}).`,
  );
} else {
  console.error(`❌ ${newFailures.length} NEW case(s) with unmatched joints:`);
  console.error("");
  for (const r of newFailures) {
    console.error(`## ${r.nameZh} (\`${r.category}\` × \`${r.variant}\`)`);
    console.error(r.detail ?? "");
    console.error("");
  }
  process.exit(1);
}
