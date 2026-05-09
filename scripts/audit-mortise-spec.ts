#!/usr/bin/env tsx
/**
 * Mortise spec audit：掃全部 template，找 mortise.origin 超出 part 範圍的 spec。
 *
 * 常見坑：template 寫 `origin: { x: 0, y: f * innerH, z: 0 }` 把 vertical
 * 位置放在 mesh local Y 軸，但 Y 軸只有 panelT 厚（≈ 18mm），origin.y =
 * f*400 = 200mm 超出範圍 → mortiseLocalBox 算 yToFace=large 但仍判 depthAxis=y
 * → CSG 切錯位置 + 不對稱（因 part rotation 讓 mesh +Y 對 LEFT/RIGHT
 * 對應到不同世界面）。
 *
 * 修法：origin.y 應只在 [0, panelT] 範圍。vertical 位置改用 origin.x（length 軸）。
 */

import { FURNITURE_CATALOG } from "@/lib/templates";
import type { Part } from "@/lib/types";

interface BadMortise {
  template: string;
  partId: string;
  partName: string;
  mortiseIdx: number;
  issue: string;
  values: { origin: { x: number; y: number; z: number }; visible: { length: number; width: number; thickness: number } };
}

function checkPart(template: string, part: Part): BadMortise[] {
  const bad: BadMortise[] = [];
  const { length: lx, thickness: ly, width: lz } = part.visible;
  part.mortises.forEach((m, i) => {
    const issues: string[] = [];
    if (m.origin.y < -1 || m.origin.y > ly + 1) {
      issues.push(`origin.y=${m.origin.y} 超出 [0, ${ly}]`);
    }
    if (m.origin.x < -lx / 2 - 1 || m.origin.x > lx / 2 + 1) {
      issues.push(`origin.x=${m.origin.x} 超出 [${-lx/2}, ${lx/2}]`);
    }
    if (m.origin.z < -lz / 2 - 1 || m.origin.z > lz / 2 + 1) {
      issues.push(`origin.z=${m.origin.z} 超出 [${-lz/2}, ${lz/2}]`);
    }
    if (issues.length > 0) {
      bad.push({
        template,
        partId: part.id,
        partName: part.nameZh ?? part.id,
        mortiseIdx: i,
        issue: issues.join(" / "),
        values: { origin: m.origin, visible: part.visible },
      });
    }
  });
  return bad;
}

function main() {
  const allBad: BadMortise[] = [];
  for (const entry of FURNITURE_CATALOG) {
    const category = entry.category;
    const tmpl = entry.template;
    if (!tmpl) continue;
    try {
      // 用該 template 的 default input 跑
      const def = entry.defaults ?? { length: 800, width: 400, height: 700 };
      const design = tmpl({
        length: def.length ?? 800,
        width: def.width ?? 400,
        height: def.height ?? 700,
        material: "maple",
        options: {},
      });
      for (const part of design.parts) {
        allBad.push(...checkPart(category, part));
      }
    } catch (e) {
      console.error(`[${category}] template eval failed:`, (e as Error).message);
    }
  }

  if (allBad.length === 0) {
    console.log("✅ 全部 template 的 mortise spec 都在合理範圍");
    process.exit(0);
  }

  // 分組顯示
  const byTemplate = new Map<string, BadMortise[]>();
  for (const b of allBad) {
    const arr = byTemplate.get(b.template) ?? [];
    arr.push(b);
    byTemplate.set(b.template, arr);
  }

  console.log(`❌ 發現 ${allBad.length} 個 mortise spec 超出 part 範圍\n`);
  for (const [tpl, list] of byTemplate) {
    console.log(`## ${tpl} (${list.length} 個)`);
    for (const b of list) {
      console.log(`  - ${b.partName} [${b.partId}] mortise #${b.mortiseIdx}: ${b.issue}`);
      console.log(`    visible: L=${b.values.visible.length} W=${b.values.visible.width} T=${b.values.visible.thickness}`);
    }
  }

  process.exit(1);
}

main();
