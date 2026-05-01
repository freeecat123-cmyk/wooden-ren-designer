import { FURNITURE_CATALOG } from "../lib/templates";
import { auditJoints, formatJointAudit } from "../lib/joinery/audit-joints";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";
import type { MaterialId } from "../lib/types";

const category = process.argv[2] || "round-stool";
const variant = process.argv[3];

const entry = FURNITURE_CATALOG.find((e) => e.category === category)!;
if (!entry) {
  console.error(`No template: ${category}`);
  process.exit(1);
}
const opts: Record<string, string | number | boolean> = {};
for (const spec of entry.optionSchema ?? []) {
  opts[spec.key] = spec.defaultValue;
}
if (variant) opts.legShape = variant;
const raw = entry.template!({
  length: entry.defaults.length,
  width: entry.defaults.width,
  height: entry.defaults.height,
  material: "maple" as MaterialId,
  options: opts,
});
const design = applyEdgeProtection(raw);

console.log(`=== ${category}${variant ? ` × ${variant}` : ""} ===`);
console.log("\n--- TENONS ---");
for (const p of design.parts) {
  for (let i = 0; i < p.tenons.length; i++) {
    const t = p.tenons[i];
    console.log(`  ${p.id} (${p.nameZh}) [${i}] ${t.position} ${t.type} L=${t.length} W=${t.width} T=${t.thickness}`);
  }
}
console.log("\n--- MORTISES ---");
for (const p of design.parts) {
  for (let i = 0; i < p.mortises.length; i++) {
    const m = p.mortises[i];
    console.log(`  ${p.id} (${p.nameZh}) [${i}] depth=${m.depth} L=${m.length} W=${m.width}${m.through ? " THROUGH" : ""}`);
  }
}
console.log("\n--- AUDIT ---");
const result = auditJoints(design);
if (result.unmatchedTenons.length === 0 && result.unmatchedMortises.length === 0) {
  console.log("✅ All matched");
} else {
  console.log(formatJointAudit(result));
}
