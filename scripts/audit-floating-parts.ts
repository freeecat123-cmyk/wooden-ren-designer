/**
 * Audit parts whose AABB extends meaningfully beyond the furniture's overall
 * bounding box — usually a sign of "floating" parts (origin offset miscalc,
 * e.g. bed headboard separated from frame, cornice with stray + 15mm gap).
 *
 * Convention: origin = bottom-center, so the part box spans:
 *   x:  origin.x ± length/2
 *   y:  origin.y .. origin.y + thickness
 *   z:  origin.z ± width/2
 *
 * The furniture bbox is:
 *   x: [-overall.length/2,  +overall.length/2]
 *   y: [0,  +overall.height]
 *   z: [-overall.width/2,  +overall.width/2]
 *
 * Floating threshold: a part is flagged if any of its 6 faces exceeds the
 * furniture face by `TOL_MM` (50mm by default — accommodates cornice/skirt
 * overhang but catches an entire detached headboard).
 *
 * Limitations:
 *   - Skips parts with `rotation` (rotated AABB requires full transform).
 *     Bed headboard and crown molding strips often have rotation, so this
 *     audit can't catch their "floating" cases — visual playwright pass needed.
 *   - Only checks if part extends OUTSIDE bbox; can't detect a part that's
 *     INSIDE bbox but disconnected (e.g. shelf with 200mm gap above frame).
 *
 * Run: pnpm tsx scripts/audit-floating-parts.ts [--strict]
 *      --strict halves the tolerance to 25mm
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import type { MaterialId } from "../lib/types";

const STRICT = process.argv.includes("--strict");
const TOL_MM = STRICT ? 25 : 50;

interface Violation {
  category: string;
  variant: string;
  partId: string;
  axis: "x" | "y" | "z";
  side: "min" | "max";
  partFace: number;
  bboxFace: number;
  overhang: number;
}

const violations: Violation[] = [];

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  // Use default options (no variants iteration — keeps audit fast and
  // catches issues that appear in the "open the page" student scenario)
  const variant = "default";
  const raw = entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: {},
  });
  const design = toBeginnerMode(raw);
  const o = design.overall;
  const bboxXMin = -o.length / 2;
  const bboxXMax = o.length / 2;
  const bboxYMin = 0;
  const bboxYMax = o.height;
  const bboxZMin = -o.width / 2;
  const bboxZMax = o.width / 2;
  for (const part of design.parts) {
    // Skip rotated parts — accurate AABB requires full rotation handling
    // (the goal is to catch obvious misplacements, not all rotated edge cases)
    if (part.rotation) continue;
    const xMin = part.origin.x - part.visible.length / 2;
    const xMax = part.origin.x + part.visible.length / 2;
    const yMin = part.origin.y;
    const yMax = part.origin.y + part.visible.thickness;
    const zMin = part.origin.z - part.visible.width / 2;
    const zMax = part.origin.z + part.visible.width / 2;
    const checks: Array<[typeof violations[0]["axis"], typeof violations[0]["side"], number, number]> = [
      ["x", "min", xMin, bboxXMin],
      ["x", "max", xMax, bboxXMax],
      ["y", "min", yMin, bboxYMin],
      ["y", "max", yMax, bboxYMax],
      ["z", "min", zMin, bboxZMin],
      ["z", "max", zMax, bboxZMax],
    ];
    for (const [axis, side, partFace, bboxFace] of checks) {
      const overhang = side === "min" ? bboxFace - partFace : partFace - bboxFace;
      if (overhang > TOL_MM) {
        violations.push({
          category: entry.category,
          variant,
          partId: part.id,
          axis,
          side,
          partFace,
          bboxFace,
          overhang,
        });
      }
    }
  }
}

console.log(`\n🚁 floating-parts audit (tol=${TOL_MM}mm ${STRICT ? "[strict]" : ""})`);
console.log(`   total violations: ${violations.length}\n`);

if (violations.length === 0) {
  console.log(`✅ no floating parts.`);
  process.exit(0);
}

// Group by (category, partId) to dedupe (e.g. headboard floating in Y will
// trigger both y-min and y-max if it's completely above the bbox).
const byPart = new Map<string, Violation[]>();
for (const v of violations) {
  const key = `${v.category} / ${v.partId}`;
  if (!byPart.has(key)) byPart.set(key, []);
  byPart.get(key)!.push(v);
}

console.log(`⚠️ floating parts by template / part:\n`);
for (const [key, vs] of [...byPart.entries()].sort()) {
  console.log(`  ${key}:`);
  for (const v of vs) {
    console.log(`    ${v.axis}-${v.side}: part face ${v.partFace.toFixed(0)}mm  bbox face ${v.bboxFace.toFixed(0)}mm  overhang ${v.overhang.toFixed(0)}mm`);
  }
}
console.log();
// Don't fail CI by default — these can be intentional overhang (cornice 15mm,
// drawer pull knob 18mm projecting forward). Use --strict for CI.
process.exit(STRICT ? 1 : 0);
