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

export function auditJoints(design: FurnitureDesign): JointAuditResult {
  const unmatchedTenons: UnmatchedTenon[] = [];
  const unmatchedMortises: UnmatchedMortise[] = [];

  // 為每個 tenon 找 OTHER part 上的 mortise（dim 對位）
  for (const part of design.parts) {
    for (const tenon of part.tenons) {
      let found = false;
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        for (const m of other.mortises) {
          if (matchTenonMortise(tenon, m)) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        unmatchedTenons.push({
          partId: part.id,
          partNameZh: part.nameZh,
          tenon,
        });
      }
    }
  }

  // 反向檢查：每個 mortise 要被 OTHER part 上的 tenon 對到
  for (const part of design.parts) {
    for (const m of part.mortises) {
      let found = false;
      for (const other of design.parts) {
        if (other.id === part.id) continue;
        for (const t of other.tenons) {
          if (matchTenonMortise(t, m)) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        unmatchedMortises.push({
          partId: part.id,
          partNameZh: part.nameZh,
          mortise: m,
        });
      }
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
