import { Euler, Vector3 } from "three";
import type { Part } from "@/lib/types";
import { LATHE_TURNED_SEGMENTS } from "@/lib/render/part-geometry";

/** A separating-plane proof using a circumscribed cylinder and stock prism.
 * No sampling: failure to prove separation keeps the audit warning. */
export function separatedFromTurnedColumn(column: Part, other: Part, low: number, high: number): boolean {
  if (![column.visible.length, column.visible.width, column.visible.thickness,
    other.visible.length, other.visible.width, other.visible.thickness].every(v => Number.isFinite(v) && v > 0)) return false;
  if (column.shape?.kind !== "lathe-turned" || column.visible.length !== column.visible.width
    || [column.rotation?.x, column.rotation?.y, column.rotation?.z].some(a => !!a)) return false;
  const shape = other.shape;
  if (shape && shape.kind !== "box" && shape.kind !== "chamfered-edges"
    && !(shape.kind === "round" && shape.axis === "x" && !shape.chamferMm
      && other.visible.width === other.visible.thickness)) return false;
  const rx = other.rotation?.x ?? 0, ry = other.rotation?.y ?? 0, rz = other.rotation?.z ?? 0;
  if (![rx, ry, rz, low, high].every(Number.isFinite) || rz !== 0
    || Math.abs(rx / (Math.PI / 2) - Math.round(rx / (Math.PI / 2))) > 1e-8) return false;
  let top = column.origin.y + column.visible.thickness;
  let radius = 0;
  for (const [rt, rb, fraction] of LATHE_TURNED_SEGMENTS) {
    const height = column.visible.thickness * fraction;
    const bottom = top - height;
    const lo = Math.max(low, bottom), hi = Math.min(high, top);
    if (hi >= lo) {
      for (const y of [lo, hi]) radius = Math.max(radius, (rb + (rt - rb) * (y - bottom) / height) * column.visible.length / 2);
    }
    top = bottom;
  }
  if (!(radius > 0)) return false;
  const rotation = new Euler(rx, ry, rz, "ZYX");
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map(v => v.applyEuler(rotation));
  const half = [other.visible.length / 2, other.visible.thickness / 2, other.visible.width / 2];
  const offset = new Vector3(other.origin.x - column.origin.x, 0, other.origin.z - column.origin.z);
  const normals = [offset.clone(), ...axes.map(v => new Vector3(v.x, 0, v.z))];
  return normals.some(normal => {
    if (normal.length() < 1e-8) return false;
    normal.normalize();
    const prismRadius = axes.reduce((sum, axis, i) => sum + Math.abs(axis.dot(normal)) * half[i], 0);
    return Math.abs(offset.dot(normal)) - prismRadius >= radius - 1e-7;
  });
}
