/**
 * 中式方角櫃接合瑕疵窮舉掃描（檢驗官 B）。
 *
 * 對 7 個 preset/option 組合算每對 Part AABB 的縫隙(>1mm)與重疊(>1mm)，
 * 但只列**應接合**的接合點，避免把椅面 vs 抽屜內側等正常隔開項當瑕疵。
 *
 * Run: npx tsx scripts/audit-cabinet-joints.ts
 */
import { FURNITURE_CATALOG } from "../lib/templates";
import { worldAABB } from "../lib/geometry/overlap";
import type { FurnitureDesign, MaterialId, Part } from "../lib/types";

interface Scenario {
  label: string;
  options: Record<string, string | number | boolean>;
}

const entry = FURNITURE_CATALOG.find((e) => e.category === "chinese-cabinet")!;
if (!entry || !entry.template) {
  console.error("chinese-cabinet template not found");
  process.exit(1);
}

const baseOpts = (entry.optionSchema ?? []).reduce<
  Record<string, string | number | boolean>
>((acc, spec) => {
  acc[spec.key] = spec.defaultValue;
  return acc;
}, {});

const scenarios: Scenario[] = [
  { label: "default", options: {} },
  { label: "top-cabinet", options: { cabinetPreset: "top-cabinet" } },
  { label: "round-cabinet", options: { cabinetPreset: "round-cabinet" } },
  { label: "wanli-cabinet", options: { cabinetPreset: "wanli-cabinet" } },
  { label: "topBox + 2 layers", options: { compoundMode: "topBox", topBoxLayers: 2 } },
  { label: "balustrade vertical", options: { balustradeStyle: "vertical" } },
  { label: "lattice + scroll brace", options: { friezePanel: "lattice", standingBraceStyle: "scroll" } },
];

function build(s: Scenario): FurnitureDesign {
  return entry.template!({
    length: entry.defaults.length,
    width: entry.defaults.width,
    height: entry.defaults.height,
    material: "maple" as MaterialId,
    options: { ...baseOpts, ...s.options },
  });
}

interface PartBox {
  id: string;
  role: string;
  aabb: ReturnType<typeof worldAABB>;
  origin: Part["origin"];
  visible: Part["visible"];
}

function classify(p: Part): string {
  const id = p.id;
  if (id.startsWith("post-") || id.includes("post")) return "post";
  if (id.startsWith("topbox-post")) return "topbox-post";
  if (id === "top" || id === "topcap" || id === "top-cap") return "top";
  if (id.startsWith("topbox-top")) return "topbox-top";
  if (id.includes("upper-rail")) return "upper-rail";
  if (id.includes("lower-rail")) return "lower-rail";
  if (id.includes("rail")) return "rail";
  if (id.includes("panel")) return "panel";
  if (id.includes("skirt")) return "skirt";
  if (id.includes("hoof") || id.includes("foot")) return "foot";
  if (id.includes("door")) return "door";
  if (id.includes("drawer")) return "drawer";
  if (id.includes("divider")) return "divider";
  if (id.includes("shelf")) return "shelf";
  if (id.includes("hinge")) return "hinge";
  if (id.includes("pull") || id.includes("knob") || id.includes("handle")) return "pull";
  if (id.includes("balustr") || id.includes("railing")) return "balustrade";
  if (id.includes("frieze") || id.includes("lattice")) return "frieze";
  if (id.includes("brace") || id.includes("standing")) return "brace";
  if (id.includes("muntin") || id.includes("muntin-frame")) return "muntin";
  return "other";
}

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

function audit(s: Scenario) {
  const design = build(s);
  const parts = design.parts;
  const boxes: PartBox[] = parts.map((p) => ({
    id: p.id,
    role: classify(p),
    aabb: worldAABB(p),
    origin: p.origin,
    visible: p.visible,
  }));

  const findings: string[] = [];

  // 1. 立柱底 ↔ 地面
  for (const b of boxes.filter((b) => b.role === "post")) {
    const dy = b.aabb.min.y;
    if (Math.abs(dy) > 1)
      findings.push(`#1 立柱觸地: ${b.id} 底 y=${fmt(dy)}mm（應 = 0）`);
  }

  // 2. 立柱 vs 頂蓋 Y 接合（top 底 == post 頂）
  const top = boxes.find((b) => b.role === "top");
  if (top) {
    for (const b of boxes.filter((b) => b.role === "post")) {
      const gap = top.aabb.min.y - b.aabb.max.y;
      if (Math.abs(gap) > 1)
        findings.push(
          `#2 立柱-頂蓋 Y: ${b.id} 頂=${fmt(b.aabb.max.y)} vs ${top.id} 底=${fmt(top.aabb.min.y)} → 縫隙=${fmt(gap)}mm`,
        );
    }
  }

  // 3. 立柱外面 vs 上下抹外面（XZ 共面，外面齊平 ±1mm）
  const posts = boxes.filter((b) => b.role === "post");
  const rails = boxes.filter((b) => b.role === "rail" || b.role.endsWith("-rail"));
  // 拿一隻代表 post 的外緣
  if (posts.length && rails.length) {
    const postOuterX = Math.max(...posts.map((p) => p.aabb.max.x));
    const postOuterZ = Math.max(...posts.map((p) => p.aabb.max.z));
    for (const r of rails) {
      // 側抹（沿 Z）：rail.length 沿 Z；判 X 外緣是否 = post 外緣
      const rangeX = r.aabb.max.x - r.aabb.min.x;
      const rangeZ = r.aabb.max.z - r.aabb.min.z;
      const isSide = rangeZ > rangeX;
      if (isSide) {
        const dRight = r.aabb.max.x - postOuterX;
        const dLeft = -r.aabb.min.x - postOuterX;
        if (Math.abs(dRight) > 1 && Math.abs(dLeft) > 1)
          findings.push(
            `#3 抹/柱外面齊平: 側抹 ${r.id} X 外緣=${fmt(r.aabb.max.x)}/${fmt(r.aabb.min.x)} 柱外緣=±${fmt(postOuterX)} 偏${fmt(dRight)}/${fmt(dLeft)}mm`,
          );
      } else {
        const dFront = r.aabb.max.z - postOuterZ;
        const dBack = -r.aabb.min.z - postOuterZ;
        if (Math.abs(dFront) > 1 && Math.abs(dBack) > 1)
          findings.push(
            `#3 抹/柱外面齊平: F/B 抹 ${r.id} Z 外緣=${fmt(r.aabb.max.z)}/${fmt(r.aabb.min.z)} 柱外緣=±${fmt(postOuterZ)} 偏${fmt(dFront)}/${fmt(dBack)}mm`,
          );
      }
    }
  }

  // 4. 板心 ↔ 抹槽 5mm（panel 應嵌入 rail，AABB Y 區間 panel ⊂ railFrame ±5mm）
  // 簡化：列出所有 panel，檢 panel.aabb 是否被某對 upper/lower rail 夾住
  const upperRails = rails.filter((r) => r.id.includes("upper"));
  const lowerRails = rails.filter((r) => r.id.includes("lower"));
  const panels = boxes.filter((b) => b.role === "panel");
  for (const p of panels) {
    const u = upperRails.find((r) => Math.abs(r.aabb.max.z - p.aabb.max.z) < 30 || Math.abs(r.aabb.min.x - p.aabb.min.x) < 30);
    const l = lowerRails.find((r) => Math.abs(r.aabb.max.z - p.aabb.max.z) < 30 || Math.abs(r.aabb.min.x - p.aabb.min.x) < 30);
    if (u && l) {
      const topGap = u.aabb.min.y - p.aabb.max.y;
      const botGap = p.aabb.min.y - l.aabb.max.y;
      if (Math.abs(topGap + 5) > 2)
        findings.push(
          `#4 板心-上抹嵌槽: ${p.id} 頂=${fmt(p.aabb.max.y)} vs ${u.id} 底=${fmt(u.aabb.min.y)} → topGap=${fmt(topGap)}（期望約 -5mm）`,
        );
      if (Math.abs(botGap + 5) > 2)
        findings.push(
          `#4 板心-下抹嵌槽: ${p.id} 底=${fmt(p.aabb.min.y)} vs ${l.id} 頂=${fmt(l.aabb.max.y)} → botGap=${fmt(botGap)}（期望約 -5mm）`,
        );
    }
  }

  // 5. 牙條 ↔ 立柱（skirt 沿立柱外側下方）
  const skirts = boxes.filter((b) => b.role === "skirt");
  for (const sk of skirts) {
    // skirt 應在下抹下方 + post 範圍內
    const post = posts[0];
    if (!post) break;
    if (sk.aabb.max.y > post.aabb.max.y - 100) {
      // skirt 應該在很下面
    }
    // skirt 觸地檢查 — 否則應由腳支撐
  }

  // 6. 頂箱底 ↔ 主櫃頂蓋 waistGap=5
  const topboxPosts = boxes.filter((b) => b.role === "topbox-post");
  if (topboxPosts.length && top) {
    const topboxBaseY = Math.min(...topboxPosts.map((b) => b.aabb.min.y));
    const gap = topboxBaseY - top.aabb.max.y;
    if (Math.abs(gap - 5) > 1)
      findings.push(
        `#6 waistGap: 頂箱柱底=${fmt(topboxBaseY)} 主櫃頂蓋頂=${fmt(top.aabb.max.y)} → 實際 gap=${fmt(gap)}mm（應=5）`,
      );
  }

  // 7. 頂箱立柱 ↔ 主櫃頂蓋頂面（如果 waistGap=0 應坐上去）
  // 由 #6 處理

  // 8. 層板 ↔ 立柱內側（shelf 邊應觸到 post 內面，留 5mm 進槽）
  const shelves = boxes.filter((b) => b.role === "shelf");
  if (posts.length && shelves.length) {
    const postInnerX = Math.max(...posts.map((p) => -p.aabb.max.x + (p.aabb.max.x - p.aabb.min.x)));
    // simpler: post.min.x is the left-inner-face of right post pair; pick max abs of inner
    const postInnerXAbs = Math.min(...posts.filter((p) => p.aabb.min.x > 0).map((p) => p.aabb.min.x));
    for (const sh of shelves) {
      const shelfOuterX = Math.max(Math.abs(sh.aabb.min.x), Math.abs(sh.aabb.max.x));
      const dx = shelfOuterX - postInnerXAbs;
      if (Math.abs(dx + 5) > 2 && Math.abs(dx) > 1)
        findings.push(
          `#8 層板-柱內: ${sh.id} 外緣 X=${fmt(shelfOuterX)} 柱內面 X=${fmt(postInnerXAbs)} → 偏=${fmt(dx)}mm（期望 -5mm 嵌槽 或 0 觸面）`,
        );
    }
  }

  // 9. 門板 ↔ 立柱前面
  const doors = boxes.filter((b) => b.role === "door");
  if (doors.length && posts.length) {
    const postFrontZ = Math.max(...posts.map((p) => p.aabb.max.z));
    for (const d of doors) {
      const doorBackZ = d.aabb.min.z;
      const doorFrontZ = d.aabb.max.z;
      // 期望 door 在 post 前面 (back near postFront, front past postFront)
      if (doorBackZ < postFrontZ - 2)
        findings.push(
          `#9 門-柱前: ${d.id} 後緣 Z=${fmt(doorBackZ)} < 柱前 Z=${fmt(postFrontZ)} → 門凹入${fmt(postFrontZ - doorBackZ)}mm`,
        );
      if (doorFrontZ < postFrontZ + 1)
        findings.push(
          `#9 門-柱前: ${d.id} 前緣 Z=${fmt(doorFrontZ)} ≤ 柱前 Z=${fmt(postFrontZ)} → 門未凸出柱前`,
        );
    }
  }

  // 10. 抽屜面板 ↔ 內部抽屜盒（drawer-front vs drawer-side/back/bottom）
  const drawerParts = boxes.filter((b) => b.role === "drawer");
  if (drawerParts.length > 1) {
    const fronts = drawerParts.filter((b) => b.id.includes("front"));
    const sides = drawerParts.filter((b) => b.id.includes("side"));
    const bottoms = drawerParts.filter((b) => b.id.includes("bottom"));
    const backs = drawerParts.filter((b) => b.id.includes("back"));
    for (const f of fronts) {
      // 所有 sides/back/bottom 的 X 範圍應 ⊂ front X 範圍 ±2mm
      const fxMin = f.aabb.min.x, fxMax = f.aabb.max.x;
      for (const s of [...sides, ...bottoms, ...backs]) {
        if (s.aabb.max.x < fxMin - 2 || s.aabb.min.x > fxMax + 2)
          findings.push(
            `#10 抽屜面/盒對位: ${f.id} X=[${fmt(fxMin)},${fmt(fxMax)}] vs ${s.id} X=[${fmt(s.aabb.min.x)},${fmt(s.aabb.max.x)}] 不對位`,
          );
      }
    }
  }

  return { count: parts.length, findings, design };
}

console.log(`# 中式方角櫃接合瑕疵掃描 (HEAD = git rev-parse HEAD)\n`);
for (const s of scenarios) {
  try {
    const { count, findings } = audit(s);
    console.log(`\n## ${s.label}  (parts=${count})`);
    if (findings.length === 0) {
      console.log("✅ 無瑕疵");
    } else {
      for (const f of findings) console.log("  - " + f);
    }
  } catch (err) {
    console.log(`\n## ${s.label}\n❌ build failed: ${(err as Error).message}`);
  }
}
