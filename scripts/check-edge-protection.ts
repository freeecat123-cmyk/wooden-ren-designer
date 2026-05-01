/**
 * 檢查 edge-protection auto-walker 在每個 template default 下到底動了什麼。
 * 輸出每個 template 內 mortise origin 偏移量 + tenon offsetWidth 設置情況。
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { applyEdgeProtection } from "../lib/joinery/edge-protection";
import type { FurnitureDesign, MaterialId } from "../lib/types";

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const opts = (entry.optionSchema ?? []).reduce<
    Record<string, string | number | boolean>
  >((acc, spec) => {
    acc[spec.key] = spec.defaultValue;
    return acc;
  }, {});
  const raw: FurnitureDesign = entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
  const protectedDesign = applyEdgeProtection(raw);

  // Compare mortise origins
  const shifted: string[] = [];
  for (let i = 0; i < raw.parts.length; i++) {
    const oldPart = raw.parts[i];
    const newPart = protectedDesign.parts[i];
    for (let mi = 0; mi < oldPart.mortises.length; mi++) {
      const oldM = oldPart.mortises[mi];
      const newM = newPart.mortises[mi];
      const dx = +(newM.origin.x - oldM.origin.x).toFixed(2);
      const dy = +(newM.origin.y - oldM.origin.y).toFixed(2);
      const dz = +(newM.origin.z - oldM.origin.z).toFixed(2);
      if (dx !== 0 || dy !== 0 || dz !== 0) {
        shifted.push(`    ${oldPart.nameZh}.mortise[${mi}] shift Δ=(${dx},${dy},${dz})`);
      }
    }
    for (let ti = 0; ti < oldPart.tenons.length; ti++) {
      const oldT = oldPart.tenons[ti];
      const newT = newPart.tenons[ti];
      const dW = (newT.offsetWidth ?? 0) - (oldT.offsetWidth ?? 0);
      const dT = (newT.offsetThickness ?? 0) - (oldT.offsetThickness ?? 0);
      if (dW !== 0 || dT !== 0) {
        shifted.push(`    ${oldPart.nameZh}.tenon[${ti}] (${oldT.position}) offsetW=${dW.toFixed(1)} offsetT=${dT.toFixed(1)}`);
      }
    }
  }

  // 計算 mortise / tenon 總數，分辨「沒榫卯」vs「有但離邊夠遠不需 protect」
  let mortiseCount = 0;
  let tenonCount = 0;
  for (const p of raw.parts) {
    mortiseCount += p.mortises.length;
    tenonCount += p.tenons.length;
  }

  if (shifted.length > 0) {
    console.log(`\n## ${entry.nameZh} (\`${entry.category}\`) — ${shifted.length} shifts`);
    for (const s of shifted) console.log(s);
  } else if (mortiseCount === 0 && tenonCount === 0) {
    console.log(`\n## ${entry.nameZh} (\`${entry.category}\`) — no joinery (skipped)`);
  } else {
    console.log(`\n## ${entry.nameZh} (\`${entry.category}\`) — ${mortiseCount} mortises / ${tenonCount} tenons, no shift needed`);
  }
}
console.log("");
