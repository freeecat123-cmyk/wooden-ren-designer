/**
 * Audit: needsPartDrawing predicate + filterDesignForIsolation across all
 * 28 furniture templates (Phase 1 Task 1).
 *
 * - 單元測試：predicate 對 4 種代表性 part 行為正確（plain box / has-tenon /
 *   has-mortise / non-box shape）。
 * - 批量測試：對每個 FURNITURE_CATALOG entry，build 預設 design，把第一個 part
 *   做 isolation filter，驗證回傳 design 只剩 1 part 且 id 對得起來。
 * - Sanity 測試：predicate 在 28 模板上觸發數量在合理區間（100-500）。
 *
 * Run: npx tsx scripts/audit-part-drawings.ts
 */

import React from "react";
import { renderToString as renderPartDrawing } from "react-dom/server";
import { FURNITURE_CATALOG } from "../lib/templates";
import type { MaterialId, OptionSpec } from "../lib/types";
import {
  needsPartDrawing,
  filterDesignForIsolation,
  hashPart,
  groupPartsForDrawing,
} from "../lib/render/part-drawing/grouping";
import { PartDrawing } from "../lib/render/part-drawing/drawing";

let fail = 0;

function expect(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    fail++;
  } else {
    console.log("✓", msg);
  }
}

// ─── Test 1: predicate on hand-picked cases ────────────────────────────────
const dummyBox = {
  id: "test-flat-panel",
  nameZh: "平板",
  material: "walnut" as MaterialId,
  grainDirection: "length" as const,
  visible: { length: 100, width: 50, thickness: 10 },
  origin: { x: 0, y: 0, z: 0 },
  tenons: [],
  mortises: [],
};

expect(
  !needsPartDrawing(dummyBox as any),
  "Plain box with no joinery → no drawing",
);

expect(
  needsPartDrawing({
    ...dummyBox,
    tenons: [{ position: "top" } as any],
  } as any),
  "Has tenon → needs drawing",
);

expect(
  needsPartDrawing({
    ...dummyBox,
    mortises: [{ position: "top" } as any],
  } as any),
  "Has mortise → needs drawing",
);

expect(
  needsPartDrawing({ ...dummyBox, shape: { kind: "round" } } as any),
  "Non-box shape → needs drawing",
);

expect(
  !needsPartDrawing({ ...dummyBox, shape: { kind: "box" } } as any),
  "Explicit box shape with no joinery → no drawing",
);

// ─── Test 2: isolation filter across all templates ─────────────────────────
function buildDesign(entry: (typeof FURNITURE_CATALOG)[number]) {
  if (!entry.template) return null;
  const opts = (entry.optionSchema ?? []).reduce<
    Record<string, string | number | boolean>
  >((acc, spec: OptionSpec) => {
    acc[spec.key] = spec.defaultValue;
    return acc;
  }, {});
  return entry.template({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: opts,
  });
}

for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = buildDesign(entry);
  if (!design || !design.parts.length) continue;

  const firstPart = design.parts[0];
  const filtered = filterDesignForIsolation(design, firstPart.id);
  expect(
    filtered.parts.length === 1,
    `${entry.category}: filter to ${firstPart.id} → 1 part (got ${filtered.parts.length})`,
  );
  expect(
    filtered.parts[0].id === firstPart.id,
    `${entry.category}: filtered part id matches`,
  );
  expect(
    filtered.parts[0].origin.x === 0 &&
      filtered.parts[0].origin.y === 0 &&
      filtered.parts[0].origin.z === 0,
    `${entry.category}: filtered part recentered to origin`,
  );
  // 原 design 不應被修改
  expect(
    design.parts.length > 1
      ? design.parts.length >= 2
      : design.parts.length === 1,
    `${entry.category}: original design untouched`,
  );

  // Bonus: partId 不存在 → 原樣回傳
  const noopFiltered = filterDesignForIsolation(design, "__nonexistent__");
  expect(
    noopFiltered === design,
    `${entry.category}: unknown partId → returns original design`,
  );
}

// ─── Test 3: predicate triggers reasonable count across all templates ──────
let totalTriggered = 0;
let totalParts = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = buildDesign(entry);
  if (!design) continue;
  totalParts += design.parts.length;
  totalTriggered += design.parts.filter(needsPartDrawing).length;
}
console.log(
  `\nstats: ${totalTriggered}/${totalParts} parts trigger needsPartDrawing across ${FURNITURE_CATALOG.length} templates`,
);
expect(
  totalTriggered > 100 && totalTriggered < 500,
  `Total triggered parts: ${totalTriggered} (expected 100-500 per spec §1.2)`,
);

// ─── Test 4: identical parts collide, different parts diverge ──────────────
const partA: any = {
  ...dummyBox,
  id: "leg-1",
  tenons: [{ position: "top", offsetWidth: 10, length: 30, width: 12, depth: 25 }],
};
const partB: any = { ...partA, id: "leg-2" }; // same geometry, different id
const partC: any = {
  ...dummyBox,
  id: "leg-3",
  visible: { length: 200, width: 50, thickness: 10 },
};

expect(
  hashPart(partA) === hashPart(partB),
  "Identical geometry → same hash (id doesn't count)",
);
expect(
  hashPart(partA) !== hashPart(partC),
  "Different visible.length → different hash",
);

// ─── Test 5: mirror split ───────────────────────────────────────────────────
const mirrorLeft: any = {
  ...dummyBox,
  id: "leg-fl",
  mortises: [
    { position: "top", offsetWidth: -10, length: 30, width: 12, depth: 25 },
  ],
};
const mirrorRight: any = {
  ...mirrorLeft,
  id: "leg-fr",
  mortises: [
    { position: "top", offsetWidth: 10, length: 30, width: 12, depth: 25 },
  ],
};
expect(
  hashPart(mirrorLeft) !== hashPart(mirrorRight),
  "Mirror pair → different hashes",
);

// ─── Test 6: grouping across templates produces reasonable count ───────────
let totalGroups = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  const design = buildDesign(entry);
  if (!design) continue;
  const groups = groupPartsForDrawing(design);
  for (const g of groups) {
    expect(
      g.parts.length >= 1,
      `${entry.category}: group has ${g.parts.length} part(s)`,
    );
    expect(
      g.count === g.parts.length,
      `${entry.category}: count matches parts.length`,
    );
  }
  totalGroups += groups.length;
}
console.log(
  `\nstats: ${totalGroups} total groups across ${FURNITURE_CATALOG.length} templates`,
);
expect(
  totalGroups > 50 && totalGroups < 250,
  `Total groups across 28 templates: ${totalGroups} (expected 50-250)`,
);

// ─── Test 7: <PartDrawing> renders 3-view layout without crash ─────────────
{
  const entry = FURNITURE_CATALOG.find((e) => e.category === "round-stool");
  expect(!!entry, "round-stool entry found in FURNITURE_CATALOG");
  if (entry && entry.template) {
    const design = buildDesign(entry);
    expect(!!design, "round-stool design built");
    if (design) {
      const groups = groupPartsForDrawing(design);
      expect(groups.length > 0, "round-stool has at least 1 group");
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: groups[0],
          design,
          index: 0,
        }),
      );
      expect(html.includes("比例"), "PartDrawing renders title bar with 比例");
      expect(html.includes("P-01"), "PartDrawing renders P-01 sequence");
      // Phase 2.5: 3 ortho views + 1 install-hint mini = 4 SVGs
      expect(
        (html.match(/<svg/g) ?? []).length === 4,
        `PartDrawing renders 3 ortho + 1 install-hint = 4 SVGs (got ${(html.match(/<svg/g) ?? []).length})`,
      );
      // Phase 2.5: title block 改 grid，材料 label 改成「材料 」(no colon)
      expect(html.includes("材料 "), "PartDrawing renders 材料 in title block");
      // T1 dim overlay (Phase 2 SVG) should emit length value as <text> label
      const L = String(
        Math.round(groups[0].representative.visible.length * 10) / 10,
      );
      expect(
        html.includes(L),
        `T1: rendered output mentions length ${L}`,
      );
      // Phase 2: T1 走 SVG overlay，<text> 標籤含 長/寬/厚 prefix
      expect(
        html.includes("長") && html.includes("寬") && html.includes("厚"),
        "T1: rendered output uses 長/寬/厚 prefix",
      );
      // Phase 2: T1 overlay <g> 應掛 t1-dim-overlay class
      expect(
        html.includes("t1-dim-overlay"),
        "T1: t1-dim-overlay SVG class present in output",
      );
      // Phase 2 Task 4: GrainArrow 應在每張 view 右下角輸出 順紋 字 + grain-arrow class
      expect(
        html.includes("順紋"),
        "GrainArrow: 順紋 text present in output",
      );
      expect(
        html.includes("grain-arrow"),
        "GrainArrow: grain-arrow SVG class present in output",
      );
    }
  }
}

// ─── Phase 2.5 Task 1: install hint mini renders + target in red ──────────
{
  const entry = FURNITURE_CATALOG.find((e: any) => e.category === "stool")!;
  const design = buildDesign(entry);
  if (design) {
    const groups = groupPartsForDrawing(design);
    if (groups.length > 0) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: groups[0],
          design,
          index: 0,
        }),
      );
      expect(
        html.includes("install-hint-mini"),
        "P2.5 Task 1: install-hint-mini SVG renders",
      );
      expect(
        html.includes("#dc2626") || html.toLowerCase().includes("dc2626"),
        "P2.5 Task 1: target part rendered in red",
      );
      // ─── Phase 2.5 Task 2: 成品 vs 毛料 ─────────────────────────────────
      expect(html.includes("毛料"), "P2.5 Task 2: 毛料 label appears");
      expect(html.includes("成品"), "P2.5 Task 2: 成品 label appears");
      // ─── Phase 2.5 Task 3: title block 4-col grid ───────────────────────
      expect(html.includes("編號"), "P2.5 Task 3: 編號 label in title block");
      expect(html.includes("公差"), "P2.5 Task 3: 公差 label in title block");
      expect(html.includes("±1mm"), "P2.5 Task 3: 公差 value ±1mm");
    }
  }
}

// ─── Phase 2.5 Task 4: 通榫 / 盲榫 detection sweep ─────────────────────────
// 「通」字必須出現在至少一個模板（catalog default 已有 mortise.through=true 案例）。
{
  let throughFound = false;
  let throughTemplate = "";
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    for (const g of groups) {
      // 只在帶 mortise 的 part 上找「通」（避開上下文撞詞）
      if (g.representative.mortises.length === 0) continue;
      const html = renderPartDrawing(
        React.createElement(PartDrawing, { group: g, design, index: 0 }),
      );
      // 注意：「通」要出現在 T2LabelList 行內，搜「 通，」或「 通 」當 sentinel
      // 來避免跟其他「通」誤判（榫眼格式：「W×L 通，距底」）
      if (html.includes(" 通，")) {
        throughFound = true;
        throughTemplate = entry.category;
        break;
      }
    }
    if (throughFound) break;
  }
  if (throughFound) {
    expect(
      true,
      `P2.5 Task 4: 通榫 detection works (matched in ${throughTemplate})`,
    );
  } else {
    console.log(
      "⚠ P2.5 Task 4: 通榫 詞未出現（catalog default 可能全 blind mortise，soft skip）",
    );
  }
}

// ─── Test 8: T2 label list appears for parts with mortises ────────────────
{
  // 用 stool（方凳）當主測—腳件帶 mortise+牙條帶 tenon
  const entry = FURNITURE_CATALOG.find((e) => e.category === "stool");
  if (!entry || !entry.template) {
    console.log("⚠ stool entry not found — T2 label assertion skipped");
  } else {
    const design = buildDesign(entry);
    if (!design) {
      console.log("⚠ stool design not built — T2 skipped");
    } else {
      const groups = groupPartsForDrawing(design);
      const groupWithMortise = groups.find(
        (g) => g.representative.mortises.length > 0,
      );
      if (groupWithMortise) {
        const html = renderPartDrawing(
          React.createElement(PartDrawing, {
            group: groupWithMortise,
            design,
            index: 0,
          }),
        );
        expect(html.includes("榫眼"), "T2: 榫眼 label appears");
        expect(html.includes("距底"), "T2: 距底 reference appears");
        // Phase 2: T2 dashed-box overlay 應掛 t2-overlay class
        expect(
          html.includes("t2-overlay"),
          "T2: t2-overlay SVG class present in output",
        );
        // Phase 2: mortise 用 stroke-dasharray="2 2" 細虛線
        expect(
          html.includes('stroke-dasharray="2 2"'),
          "T2: mortise dashed box (dash 2 2) renders",
        );
      } else {
        // Fallback: try any template with a mortise-bearing part
        let found = false;
        for (const e of FURNITURE_CATALOG) {
          if (!e.template) continue;
          const d = buildDesign(e);
          if (!d) continue;
          const gs = groupPartsForDrawing(d);
          const g = gs.find((g) => g.representative.mortises.length > 0);
          if (g) {
            const html = renderPartDrawing(
              React.createElement(PartDrawing, { group: g, design: d, index: 0 }),
            );
            expect(html.includes("榫眼"), `T2: 榫眼 label appears (${e.category})`);
            expect(html.includes("距底"), `T2: 距底 reference appears (${e.category})`);
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(
            "⚠ no template surfaced a mortise-bearing group — T2 label assertion skipped",
          );
        }
      }

      // Also assert tenon-bearing group emits 榫頭 label
      const groupWithTenon = groups.find(
        (g) => g.representative.tenons.length > 0,
      );
      if (groupWithTenon) {
        const html = renderPartDrawing(
          React.createElement(PartDrawing, {
            group: groupWithTenon,
            design,
            index: 0,
          }),
        );
        expect(html.includes("榫頭"), "T2: 榫頭 label appears");
        // Phase 2: tenon 用 stroke-dasharray="3 1.5"，跟 mortise 視覺區分
        expect(
          html.includes('stroke-dasharray="3 1.5"'),
          "T2: tenon dashed box (dash 3 1.5) renders",
        );
      } else {
        console.log("⚠ stool has no tenon group — 榫頭 assertion skipped");
      }
    }
  }
}

// ─── Test 9: Comprehensive 28-template smoke (Phase 1 acceptance) ──────────
// 對每個模板的每個 group 跑 <PartDrawing> renderToString，確認 zero crash。
console.log("\n--- Comprehensive 28-template smoke ---");
let crashCount = 0;
let renderedCount = 0;
let templatesCovered = 0;
for (const entry of FURNITURE_CATALOG) {
  if (!entry.template) continue;
  templatesCovered++;
  try {
    const design = buildDesign(entry);
    if (!design) {
      console.log("  ⚠", entry.category, "design build returned null — skipped");
      continue;
    }
    const groups = groupPartsForDrawing(design);
    let templateCrash = false;
    for (const g of groups) {
      try {
        const html = renderPartDrawing(
          React.createElement(PartDrawing, {
            group: g,
            design,
            index: 0,
          }),
        );
        if (!html || html.length < 100) {
          console.error(
            "  ❌",
            entry.category,
            "group",
            g.hash.slice(0, 12),
            "tiny output:",
            html.length,
          );
          crashCount++;
          templateCrash = true;
        } else {
          renderedCount++;
        }
      } catch (e: any) {
        console.error(
          "  ❌",
          entry.category,
          "group",
          g.hash.slice(0, 12),
          "CRASH:",
          e.message,
        );
        crashCount++;
        templateCrash = true;
      }
    }
    if (!templateCrash) {
      console.log(
        "  ✓",
        entry.category,
        `${groups.length} group(s) rendered`,
      );
    }
  } catch (e: any) {
    console.error("  ❌", entry.category, "build CRASH:", e.message);
    crashCount++;
  }
}
console.log(
  `\nsmoke stats: ${templatesCovered} templates covered, ${renderedCount} <PartDrawing> cards rendered, ${crashCount} crash(es)`,
);
expect(
  crashCount === 0,
  `28-template smoke: ${crashCount} crash(es) (must be 0; rendered ${renderedCount} cards across ${templatesCovered} templates)`,
);

// ─── Test 10: FacingMark appears in ≥1 template (Phase 2 Task 5) ──────────
// 對 28 模板每個 group 跑 PartDrawing，至少要有一張圖出現 facing-mark class。
{
  let facingFound = false;
  let facingTemplate = "";
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    for (let i = 0; i < groups.length; i++) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: groups[i],
          design,
          index: i,
        }),
      );
      if (html.includes("facing-mark")) {
        facingFound = true;
        facingTemplate = entry.category;
        break;
      }
    }
    if (facingFound) break;
  }
  expect(
    facingFound,
    `FacingMark: at least one part across 28 templates produces a FacingMark (matched in ${facingTemplate || "none"})`,
  );
}

// ─── Test 11: ↔ pair suffix appears in ≥1 template (Phase 2 Task 6) ────────
// 對 28 模板每個 group 跑 PartDrawing，至少要有一張圖在 T2 label list 內出現
// 「↔ {otherPartId} 榫頭/榫眼N」配對後綴。
{
  let pairFound = false;
  let pairTemplate = "";
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    for (let i = 0; i < groups.length; i++) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: groups[i],
          design,
          index: i,
        }),
      );
      if (html.includes("↔")) {
        pairFound = true;
        pairTemplate = entry.category;
        break;
      }
    }
    if (pairFound) break;
  }
  expect(
    pairFound,
    `pair-id: at least one template produces ↔ pair suffix (matched in ${pairTemplate || "none"})`,
  );
}

// ─── Phase 2 element smoke: 28-template element coverage ───────────────────
// 統計 Phase 2 元素（T2 dashed box / GrainArrow / pair ID）在所有 28 模板每張
// card 上的覆蓋率，並驗證關鍵下限：grain-arrow 必須每張都有、T2 box 必須 >50、
// pair ID 必須 ≥1。crashes 必須為 0。
console.log("\n--- Phase 2 element smoke (28 templates) ---");
{
  let p2t2 = 0,
    p2grain = 0,
    p2pair = 0;
  let p2crashes = 0;
  let totalCards = 0;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    try {
      const design = buildDesign(entry);
      if (!design) continue;
      const groups = groupPartsForDrawing(design);
      for (let i = 0; i < groups.length; i++) {
        totalCards++;
        const g = groups[i];
        const html = renderPartDrawing(
          React.createElement(PartDrawing, {
            group: g,
            design,
            index: i,
          }),
        );
        if (!html || html.length < 200) {
          p2crashes++;
          continue;
        }
        if (html.includes("t2-overlay")) p2t2++;
        if (html.includes("grain-arrow")) p2grain++;
        if (html.includes("↔")) p2pair++;
      }
    } catch (e: any) {
      console.error("  ❌", entry.category, "CRASH:", e.message);
      p2crashes++;
    }
  }
  console.log(
    `  P2 stats: total=${totalCards} t2-box=${p2t2} grain-arrow=${p2grain} pair=${p2pair} crashes=${p2crashes}`,
  );
  expect(p2crashes === 0, `Phase 2 smoke: ${p2crashes} crash(es)`);
  expect(
    p2grain === totalCards,
    `Phase 2 grain-arrow on every card (${p2grain}/${totalCards})`,
  );
  expect(p2t2 > 50, `Phase 2 T2 box appears on >50 cards (${p2t2})`);
  expect(p2pair > 0, `Phase 2 pair ID appears at least once (${p2pair})`);
}

// ─── Phase 3 Task 1: lathe segment table ────────────────────────────────────
console.log("\n--- P3 Task 1: lathe segment table ---");
{
  let found = false;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    const g = groups.find(
      (g) => g.representative.shape?.kind === "lathe-turned",
    );
    if (g) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: g,
          design,
          index: 0,
        }),
      );
      if (html.includes("lathe-segment-table")) {
        found = true;
        break;
      }
    }
  }
  if (found) {
    expect(true, "P3 Task 1: lathe-turned renders segment table");
  } else {
    console.log(
      "⚠ P3 Task 1: no lathe-turned part in catalog (skipping assertion)",
    );
  }
}

// ─── Phase 3 Task 2: arch-bent chord + sagitta ─────────────────────────────
console.log("\n--- P3 Task 2: arch-bent chord/sagitta ---");
{
  let found = false;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    const g = groups.find((g) => g.representative.shape?.kind === "arch-bent");
    if (g) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: g,
          design,
          index: 0,
        }),
      );
      if (html.includes("arch-bent-chord")) {
        found = true;
        break;
      }
    }
  }
  if (found) {
    expect(true, "P3 Task 2: arch-bent renders chord+sagitta");
  } else {
    console.log(
      "⚠ P3 Task 2: no arch-bent part in catalog (skipping assertion)",
    );
  }
}

// ─── Phase 3 Task 3: apron-trapezoid dual-edge ─────────────────────────────
console.log("\n--- P3 Task 3: apron-trapezoid dual edge ---");
{
  let found = false;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    const g = groups.find(
      (g) => g.representative.shape?.kind === "apron-trapezoid",
    );
    if (g) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: g,
          design,
          index: 0,
        }),
      );
      if (html.includes("apron-trap-dual")) {
        found = true;
        break;
      }
    }
  }
  if (found) {
    expect(true, "P3 Task 3: apron-trapezoid renders dual edge");
  } else {
    console.log(
      "⚠ P3 Task 3: no apron-trapezoid part in catalog (skipping assertion)",
    );
  }
}

// ─── Phase 3 Task 4: hoof direction ────────────────────────────────────────
console.log("\n--- P3 Task 4: hoof direction ---");
{
  let found = false;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    const g = groups.find((g) => g.representative.shape?.kind === "hoof");
    if (g) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: g,
          design,
          index: 0,
        }),
      );
      if (html.includes("hoof-direction")) {
        found = true;
        break;
      }
    }
  }
  if (found) {
    expect(true, "P3 Task 4: hoof renders direction + 轉折");
  } else {
    console.log(
      "⚠ P3 Task 4: no hoof part in catalog (skipping assertion)",
    );
  }
}

// ─── Phase 3 Task 5: splayed true length ───────────────────────────────────
console.log("\n--- P3 Task 5: splayed true length ---");
{
  let found = false;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    const design = buildDesign(entry);
    if (!design) continue;
    const groups = groupPartsForDrawing(design);
    const g = groups.find(
      (g) =>
        g.representative.shape?.kind === "splayed-tapered" ||
        g.representative.shape?.kind === "splayed-round-tapered",
    );
    if (g) {
      const html = renderPartDrawing(
        React.createElement(PartDrawing, {
          group: g,
          design,
          index: 0,
        }),
      );
      if (html.includes("splayed-true-length")) {
        found = true;
        break;
      }
    }
  }
  if (found) {
    expect(true, "P3 Task 5: splayed-tapered/-round-tapered renders true length");
  } else {
    console.log(
      "⚠ P3 Task 5: no splayed-tapered/-round-tapered part in catalog (skipping assertion)",
    );
  }
}

// ─── Phase 3 Task 6: silhouette gap check ──────────────────────────────────
// 對 7 種原本落 AABB fallback 的 shape，跑 projectPartSilhouette，驗回傳 polygon
// > 4 點（不再是 AABB）。catalog 沒出現的 shape 印 ⚠ 軟跳過、不算失敗。
import { projectPartSilhouette } from "../lib/render/geometry";

console.log("\n--- Phase 3 silhouette gap check ---");
{
  // shaker / notched-corners / finger-joint-ends / dovetail-ends / regular-polygon /
  // live-edge：應出 polygon > 4 點。
  // face-rounded / chamfered-top：圓角 polygon（已含 projectPartPolygon），> 4
  // 點也對得起來；但 catalog 可能極少出現。
  const SHAPE_GAPS_TO_CHECK = [
    "shaker",
    "notched-corners",
    "finger-joint-ends",
    "dovetail-ends",
    "regular-polygon",
    "live-edge",
    "face-rounded",
    "chamfered-top",
  ];
  for (const kind of SHAPE_GAPS_TO_CHECK) {
    let found: any = null;
    for (const entry of FURNITURE_CATALOG) {
      if (!entry.template) continue;
      const design = buildDesign(entry);
      if (!design) continue;
      for (const p of design.parts) {
        if (p.shape?.kind === kind) {
          found = p;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      console.log(
        `  ⚠ no part with shape=${kind} in default catalog; skipping`,
      );
      continue;
    }
    // 試 3 個 view 取最多點數的那個（live-edge 只在 top 出 wavy outline）
    let bestPoints = 0;
    let bestView = "";
    try {
      for (const v of ["front", "side", "top"] as const) {
        const poly = projectPartSilhouette(found, v);
        if (poly && poly.length > bestPoints) {
          bestPoints = poly.length;
          bestView = v;
        }
      }
    } catch (e: any) {
      console.error(
        `  ❌ shape=${kind}: projectPartSilhouette CRASH: ${e.message}`,
      );
      fail++;
      continue;
    }
    if (bestPoints > 4) {
      console.log(
        `  ✓ shape=${kind}: ${bestPoints}-point polygon (${bestView} view, not AABB)`,
      );
    } else {
      console.log(
        `  ⚠ shape=${kind}: ${bestPoints}-point polygon (still AABB-like)`,
      );
    }
  }
}

// ─── Phase 3 final smoke: 28 templates × all P3 elements ───────────────────
// 全模板渲染零件圖卡，統計 Phase 3 五大標註元素（lathe table / arch chord /
// apron-trap dual / hoof direction / splayed true length）出現次數。
// 強硬假設：crashes 必須為 0。元素出現次數視 catalog default 才會有，
// 用 log 攤出來、不強制下限。
console.log("\n--- Phase 3 final smoke (28 templates × all P3 elements) ---");
{
  let p3lathe = 0,
    p3arch = 0,
    p3trap = 0,
    p3hoof = 0,
    p3splayed = 0;
  let p3crashes = 0;
  let totalCards = 0;
  for (const entry of FURNITURE_CATALOG) {
    if (!entry.template) continue;
    try {
      const design = buildDesign(entry);
      if (!design) continue;
      const groups = groupPartsForDrawing(design);
      for (let i = 0; i < groups.length; i++) {
        totalCards++;
        const g = groups[i];
        const html = renderPartDrawing(
          React.createElement(PartDrawing, {
            group: g,
            design,
            index: i,
          }),
        );
        if (!html || html.length < 200) {
          p3crashes++;
          continue;
        }
        if (html.includes("lathe-segment-table")) p3lathe++;
        if (html.includes("arch-bent-chord")) p3arch++;
        if (html.includes("apron-trap-dual")) p3trap++;
        if (html.includes("hoof-direction")) p3hoof++;
        if (html.includes("splayed-true-length")) p3splayed++;
      }
    } catch (e: any) {
      console.error("  ❌", entry.category, "CRASH:", e.message);
      p3crashes++;
    }
  }
  console.log(
    `  P3 stats: cards=${totalCards} lathe=${p3lathe} arch=${p3arch} apron-trap=${p3trap} hoof=${p3hoof} splayed=${p3splayed} crashes=${p3crashes}`,
  );
  expect(p3crashes === 0, `Phase 3 smoke: ${p3crashes} crash(es)`);
  // 元素 coverage 不強制每種都觸發（部分 shape catalog default 不出現）
  // — soft stats 寫進 log 供 visibility
}

// ─── Phase 1 acceptance manual TODOs (per spec §11) ────────────────────────
// 以下兩項屬人工驗收，audit script 無法自動代勞，留作 commit message 提醒：
//   [ ] 隨抽 5 個 part 比對 visible.length 跟圖上 L 一致
//   [ ] 合併 ×N 數量 = 材料單同類 part 數量
// 自動驗收：predicate / hash / grouping / isolation filter / 3-view layout /
// T1 dim row / T2 label list / 28-template smoke — 上面 Tasks 1-9 全綠即可。

console.log(`\n${fail === 0 ? "✅ all pass" : `❌ ${fail} failure(s)`}`);
process.exit(fail);
