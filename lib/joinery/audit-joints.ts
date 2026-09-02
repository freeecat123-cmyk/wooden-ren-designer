import type { FurnitureDesign, Mortise, Part, Tenon } from "@/lib/types";

/**
 * 榫接 audit：joineryMode 下檢查每個 tenon 找得到對應 mortise（dim 對位）。
 * butt-joint 預設不跑（因為 toBeginnerMode 把榫頭都拔掉了）。
 *
 * v1：只比對尺寸（length/width/thickness），不比對 origin 位置。
 * 位置 audit 留下一版（需要 Three.js XYZ rotation 換世界座標，跟 overlap.ts 同套路）。
 */

export const JOINT_DIM_TOL = 1; // mm，tenon ↔ mortise 維度容忍

export interface UnmatchedTenon {
  partId: string;
  partNameZh: string;
  tenon: Tenon;
}

export interface UnmatchedMortise {
  partId: string;
  partNameZh: string;
  mortise: Mortise;
}

export interface JointAuditResult {
  unmatchedTenons: UnmatchedTenon[];
  unmatchedMortises: UnmatchedMortise[];
}

/** mortise.depth ≈ tenon.length、mortise.length ≈ tenon.width、mortise.width ≈ tenon.thickness */
function matchTenonMortise(t: Tenon, m: Mortise, tol = JOINT_DIM_TOL): boolean {
  return (
    Math.abs(m.depth - t.length) < tol &&
    Math.abs(m.length - t.width) < tol &&
    Math.abs(m.width - t.thickness) < tol
  );
}

/** 斷面對得上（length↔width、width↔thickness），不管深度 */
function crossSectionMatch(t: Tenon, m: Mortise, tol = JOINT_DIM_TOL): boolean {
  return Math.abs(m.length - t.width) < tol && Math.abs(m.width - t.thickness) < tol;
}

export function auditJoints(design: FurnitureDesign): JointAuditResult {
  const unmatchedTenons: UnmatchedTenon[] = [];
  const unmatchedMortises: UnmatchedMortise[] = [];
  const allMortises = design.parts.flatMap((p) => p.mortises.map((m) => ({ partId: p.id, m })));
  const consumed = new Set<Mortise>();

  /**
   * 一支榫頭「用掉」哪些母榫：
   *  - 一般：另一件上 depth≈length 的一個母榫
   *  - 穿越（2026-09-02，餐椅椅背條）：先穿過一片板的**通孔**（depth = 板厚 < 榫長），
   *    再插進第三件的母榫（depth ≈ 榫長 − 板厚）。兩個都算對到。
   */
  const consumeFor = (partId: string, tenon: Tenon): Mortise[] | null => {
    for (const { partId: pid, m } of allMortises) {
      if (pid === partId) continue;
      if (matchTenonMortise(tenon, m)) return [m];
    }
    for (const { partId: pid, m: pass } of allMortises) {
      if (pid === partId || !pass.through || !crossSectionMatch(tenon, pass) || pass.depth >= tenon.length) continue;
      const rest = tenon.length - pass.depth;
      for (const { partId: pid2, m: end } of allMortises) {
        if (pid2 === partId || pid2 === pid || end === pass) continue;
        if (crossSectionMatch(tenon, end) && Math.abs(end.depth - rest) < JOINT_DIM_TOL) return [pass, end];
      }
    }
    return null;
  };

  // 為每個 tenon 找 OTHER part 上的 mortise（dim 對位）
  for (const part of design.parts) {
    for (const tenon of part.tenons) {
      const used = consumeFor(part.id, tenon);
      if (used) { for (const m of used) consumed.add(m); }
      else unmatchedTenons.push({ partId: part.id, partNameZh: part.nameZh, tenon });
    }
  }

  // 反向檢查：每個 mortise 要被 OTHER part 上的 tenon 對到（含被穿越的通孔與穿越後的終點母榫）
  // cosmetic mortise（無線充電凹槽、後板穿線孔等產品功能）不是榫接，跳過
  for (const part of design.parts) {
    for (const m of part.mortises) {
      if (m.cosmetic) continue;
      if (consumed.has(m)) continue;
      // 同尺寸的母榫可能有很多顆（四支腳）而 consumeFor 每支榫頭只登記第一顆 → 反向再用維度比一次
      let found = false;
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        for (const t of other.tenons) {
          if (matchTenonMortise(t, m)) { found = true; break; }
          // 穿越：這顆是通孔且有榫頭比它長、剩餘長度在別件有終點母榫；或這顆是終點母榫
          if (crossSectionMatch(t, m) && t.length > m.depth + JOINT_DIM_TOL) {
            const rest = t.length - m.depth;
            if (allMortises.some(({ partId: pid2, m: m2 }) => pid2 !== other.id && m2 !== m && crossSectionMatch(t, m2) &&
              ((m.through && Math.abs(m2.depth - rest) < JOINT_DIM_TOL) || (m2.through && Math.abs(m2.depth - rest) < JOINT_DIM_TOL)))) { found = true; break; }
          }
        }
        if (found) break;
      }
      if (!found) unmatchedMortises.push({ partId: part.id, partNameZh: part.nameZh, mortise: m });
    }
  }

  return { unmatchedTenons, unmatchedMortises };
}

export function formatJointAudit(result: JointAuditResult): string {
  const lines: string[] = [];
  if (result.unmatchedTenons.length > 0) {
    lines.push(`找不到對應母榫的公榫 (${result.unmatchedTenons.length})：`);
    for (const u of result.unmatchedTenons) {
      lines.push(
        `  - ${u.partNameZh} (${u.partId}) · ${u.tenon.position} ${u.tenon.type} ` +
          `L=${u.tenon.length} W=${u.tenon.width} T=${u.tenon.thickness}`,
      );
    }
  }
  if (result.unmatchedMortises.length > 0) {
    lines.push(`找不到對應公榫的母榫 (${result.unmatchedMortises.length})：`);
    for (const u of result.unmatchedMortises) {
      lines.push(
        `  - ${u.partNameZh} (${u.partId}) · depth=${u.mortise.depth} ` +
          `L=${u.mortise.length} W=${u.mortise.width}` +
          (u.mortise.through ? " (通孔)" : ""),
      );
    }
  }
  return lines.join("\n");
}
