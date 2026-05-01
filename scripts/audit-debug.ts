import { FURNITURE_CATALOG } from "../lib/templates";
import { toBeginnerMode } from "../lib/templates/beginner-mode";
import { worldAABB } from "../lib/geometry/overlap";
import type { MaterialId, FurnitureDesign } from "../lib/types";

const TARGET = process.argv[2] ?? "dining-table";
const entry = FURNITURE_CATALOG.find((e) => e.category === TARGET);
if (!entry?.template) {
  console.error("not found", TARGET);
  process.exit(1);
}
const opts = (entry.optionSchema ?? []).reduce<Record<string, string | number | boolean>>(
  (acc, s) => ({ ...acc, [s.key]: s.defaultValue }),
  {},
);
const raw: FurnitureDesign = entry.template({
  length: entry.defaults.length,
  width: entry.defaults.width,
  height: entry.defaults.height,
  material: "maple" as MaterialId,
  options: opts,
});
const design = toBeginnerMode(raw);
console.log(`# ${TARGET} (${design.parts.length} parts, beginner mode)`);
console.log("");
for (const p of design.parts) {
  const a = worldAABB(p);
  console.log(
    `${p.id.padEnd(20)} | visible ${String(p.visible.length).padStart(5)}×${String(p.visible.width).padStart(4)}×${String(p.visible.thickness).padStart(3)} | origin (${p.origin.x.toFixed(0)}, ${p.origin.y.toFixed(0)}, ${p.origin.z.toFixed(0)}) | rot ${p.rotation ? `(${(p.rotation.x*180/Math.PI).toFixed(0)},${(p.rotation.y*180/Math.PI).toFixed(0)},${(p.rotation.z*180/Math.PI).toFixed(0)})` : "—"} | aabb x[${a.min.x.toFixed(0)},${a.max.x.toFixed(0)}] y[${a.min.y.toFixed(0)},${a.max.y.toFixed(0)}] z[${a.min.z.toFixed(0)},${a.max.z.toFixed(0)}]`,
  );
}
