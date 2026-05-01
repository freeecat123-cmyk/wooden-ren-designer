import { FURNITURE_CATALOG } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import { findOverlaps, worldAABB, aabbIntersection } from "../lib/geometry/overlap";
import type { MaterialId, FurnitureDesign } from "../lib/types";

const TARGET = process.argv[2] ?? "dining-table";
const entry = FURNITURE_CATALOG.find((e) => e.category === TARGET)!;
const opts = (entry.optionSchema ?? []).reduce<Record<string, string|number|boolean>>((a,s)=>({...a, [s.key]: s.defaultValue}), {});
const raw: FurnitureDesign = entry.template!({ length: entry.defaults.length, width: entry.defaults.width, height: entry.defaults.height, material: "maple" as MaterialId, options: opts });
const d = toBeginnerMode(raw);
const overlaps = findOverlaps(d.parts);
console.log(`overlaps: ${overlaps.length}`);
overlaps.forEach(o => console.log(`  ${o.a} × ${o.b}  ${o.intersectionMm.x}×${o.intersectionMm.y}×${o.intersectionMm.z}`));
// Manual check apron-front × leg-1
const apron = d.parts.find(p => p.id === "apron-front")!;
const leg = d.parts.find(p => p.id === "leg-1")!;
const ab = worldAABB(apron), lb = worldAABB(leg);
console.log("\nManual apron-front:", JSON.stringify(ab));
console.log("Manual leg-1:      ", JSON.stringify(lb));
console.log("Intersection:      ", aabbIntersection(ab, lb));
