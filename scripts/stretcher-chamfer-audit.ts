/* eslint-disable */
import { FURNITURE_CATALOG } from "../lib/templates/index";

const TARGETS = new Set([
  "stool",
  "bar-stool",
  "bed",
  "bench",
  "desk",
  "dining-chair",
  "dining-table",
  "low-table",
  "round-stool",
  "round-table",
  "round-tea-table",
  "side-table",
  "tea-table",
]);

function isStretcherLikeId(id: string) {
  return (
    id.startsWith("apron-") ||
    id.startsWith("ls-") ||
    id.startsWith("lower-stretcher") ||
    id.startsWith("center-stretcher") ||
    id.includes("stretcher") ||
    id.startsWith("side-rail") ||
    id.startsWith("desk-h-") ||
    id.startsWith("drawer-bottom-rail")
  );
}

function chamferState(part: any): string {
  if (!part) return "(missing)";
  const s = part.shape;
  if (!s) return "—(no shape)";
  if (s.kind === "chamfered-edges") return `chamfered-edges(c=${s.chamferMm}, ${s.style ?? "chamfered"})`;
  if (s.kind === "apron-trapezoid") return `apron-trapezoid(top=${s.topLengthScale?.toFixed(3)}, bot=${s.bottomLengthScale?.toFixed(3)}${s.bevelMode ? `, half-bevel` : ""})`;
  if (s.kind === "apron-beveled") return `apron-beveled(b=${s.bevelAngle?.toFixed(3) ?? 0})`;
  if (s.kind === "apron-half-beveled") return `apron-half-beveled(b=${s.bevelAngle?.toFixed(3) ?? 0})`;
  return s.kind ?? JSON.stringify(s);
}

function tryBuild(template: any, input: any) {
  try {
    return template(input);
  } catch (e: any) {
    return { __err: e?.message ?? String(e) };
  }
}

async function main() {
  for (const entry of FURNITURE_CATALOG) {
    if (!TARGETS.has(entry.category)) continue;
    if (!entry.template) continue;

    const baseOpts: any = {
      stretcherEdge: 0,
      stretcherEdgeStyle: "chamfered",
      withApron: true,
      withLowerStretcher: true,
      withLowerStretchers: true,
      withCenterStretcher: true,
      withHFrame: true,
      drawerCount: 2,
      drawerStyle: "pedestal",
      lowerStretcherArrangement: "h-frame",
      legShape: "box",
      legEdge: 0,
    };
    const chamferOpts: any = {
      ...baseOpts,
      stretcherEdge: 8,
      stretcherEdgeStyle: "chamfered",
    };
    const roundedOpts: any = {
      ...baseOpts,
      stretcherEdge: 8,
      stretcherEdgeStyle: "rounded",
    };

    const baseInput = {
      length: entry.defaults.length,
      width: entry.defaults.width,
      height: entry.defaults.height,
      material: "maple" as const,
      options: baseOpts,
    };

    const designA = tryBuild(entry.template, baseInput);
    const designB = tryBuild(entry.template, { ...baseInput, options: chamferOpts });
    const designC = tryBuild(entry.template, { ...baseInput, options: roundedOpts });

    console.log(`\n=== ${entry.category} (${entry.nameZh}) ===`);
    if ((designA as any).__err) { console.log("  BUILD ERR base:", (designA as any).__err); continue; }
    if ((designB as any).__err) { console.log("  BUILD ERR chamfer=8:", (designB as any).__err); continue; }

    const partsB = (designB as any).parts.filter((p: any) => isStretcherLikeId(p.id));
    if (partsB.length === 0) {
      console.log("  (no stretcher-like parts; template may need diff options to spawn)");
    }
    for (const p of partsB) {
      const stateA = chamferState((designA as any).parts.find((q: any) => q.id === p.id));
      const stateB = chamferState(p);
      const stateC = chamferState((designC as any).parts.find((q: any) => q.id === p.id));
      const isChamfered = stateB.startsWith("chamfered-edges");
      const isRounded = stateC.startsWith("chamfered-edges") && stateC.includes("rounded");
      const flag = isChamfered ? "OK" : (stateB.includes("apron-trapezoid") ? "FALLBACK-trap" : (stateB === "—(no shape)" ? "NO-SHAPE" : "OTHER"));
      const roundedNote = !isRounded ? "  ROUNDED-FAIL" : "";
      console.log(`  [${flag}] ${p.id.padEnd(34)}  edge=0: ${stateA.padEnd(40)}  edge=8: ${stateB}${roundedNote}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
