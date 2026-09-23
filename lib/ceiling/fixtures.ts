/**
 * 燈具 / 開孔位置 + 與骨架碰撞檢查
 *
 * 座標跟 SVG / 3D 一致:x 沿長邊(cm),z 沿短邊(cm),從房間 0,0 起算。
 */

import type { CeilingBom } from "./types";

export type FixtureKind = "led" | "vent" | "speaker" | "sprinkler" | "other";

export interface Fixture {
  id: string;
  kind: FixtureKind;
  label: string;
  /** 中心 X(沿長邊 cm,從房間 0 起算) */
  xCm: number;
  /** 中心 Z(沿短邊 cm) */
  zCm: number;
  /** 開孔半徑(cm)— 方形開孔用外接圓近似 */
  rCm: number;
}

export const FIXTURE_KIND_LABEL: Record<FixtureKind, string> = {
  led: "LED 燈孔",
  vent: "出風口",
  speaker: "喇叭",
  sprinkler: "灑水頭",
  other: "其他開孔",
};

export const FIXTURE_KIND_DEFAULT_R: Record<FixtureKind, number> = {
  led: 5,        // LED 嵌燈 10 cm 直徑
  vent: 15,      // 出風口 30 cm
  speaker: 8,    // 嵌入喇叭 16 cm
  sprinkler: 3,  // 灑水頭 6 cm
  other: 5,
};

export interface FixtureCollision {
  fixtureId: string;
  fixtureLabel: string;
  /** 撞到的結構件描述,例 "主支 #3"、"副支 (slot 2, 第 4 根)" */
  hitWith: string;
  /** 撞到距離(circle 圓邊到 timber 邊的 penetration 深度,> 0 = 重疊) */
  penetrationCm: number;
}

/**
 * 圓 vs 軸對齊矩形 碰撞檢查
 * 回傳 penetration(圓邊穿進矩形多深);0 = 剛好相切,> 0 = 重疊。
 */
function circleVsRect(
  cx: number, cz: number, r: number,
  rectX: number, rectZ: number, rectW: number, rectH: number,
): number {
  // closest point on rect to circle center
  const closestX = Math.max(rectX, Math.min(cx, rectX + rectW));
  const closestZ = Math.max(rectZ, Math.min(cz, rectZ + rectH));
  const dx = cx - closestX;
  const dz = cz - closestZ;
  const distSq = dx * dx + dz * dz;
  return r - Math.sqrt(distSq); // > 0 = collide
}

/**
 * 檢查所有燈具 vs 骨架(主支 + 副支 + 邊框)碰撞
 * 回傳碰撞清單(空 = 無問題)
 */
export function checkFixtureCollisions(
  fixtures: Fixture[],
  bom: CeilingBom,
): FixtureCollision[] {
  const { input, trace } = bom;
  const tw = input.timberWidthCm;
  const halfTw = tw / 2;
  const L = input.longSideCm;
  const S = input.shortSideCm;
  const collisions: FixtureCollision[] = [];

  for (const f of fixtures) {
    // 主支:跨短邊內側,X 中心 = mainCenter,寬 tw,Z 從 frameW 到 S-frameW
    trace.mainJoistCentersCm.forEach((cx, idx) => {
      const pen = circleVsRect(
        f.xCm, f.zCm, f.rCm,
        cx - halfTw, tw, tw, S - 2 * tw,
      );
      if (pen > 0) {
        collisions.push({
          fixtureId: f.id,
          fixtureLabel: f.label || `${FIXTURE_KIND_LABEL[f.kind]}`,
          hitWith: `主支 #${idx + 1}(X=${r1(cx)} cm)`,
          penetrationCm: pen,
        });
      }
    });

    // 副支:每 slot 內,X 從 slot.from 到 slot.to,Z 中心 = innerY0 + subY,寬 tw
    for (let si = 0; si < trace.slots.length; si++) {
      const slot = trace.slots[si];
      for (let i = 0; i < trace.subJoistYOffsetsCm.length; i++) {
        const zCenter = tw + trace.subJoistYOffsetsCm[i];
        const pen = circleVsRect(
          f.xCm, f.zCm, f.rCm,
          slot.fromCm, zCenter - halfTw, slot.toCm - slot.fromCm, tw,
        );
        if (pen > 0) {
          collisions.push({
            fixtureId: f.id,
            fixtureLabel: f.label || FIXTURE_KIND_LABEL[f.kind],
            hitWith: `副支 (slot ${si + 1}, 第 ${i + 1} 根)`,
            penetrationCm: pen,
          });
        }
      }
    }

    // 邊框:4 條
    const frames = [
      { x: 0, z: 0, w: L, h: tw, name: "上邊框" },
      { x: 0, z: S - tw, w: L, h: tw, name: "下邊框" },
      { x: 0, z: 0, w: tw, h: S, name: "左邊框" },
      { x: L - tw, z: 0, w: tw, h: S, name: "右邊框" },
    ];
    for (const fr of frames) {
      const pen = circleVsRect(f.xCm, f.zCm, f.rCm, fr.x, fr.z, fr.w, fr.h);
      if (pen > 0) {
        collisions.push({
          fixtureId: f.id,
          fixtureLabel: f.label || FIXTURE_KIND_LABEL[f.kind],
          hitWith: fr.name,
          penetrationCm: pen,
        });
      }
    }
  }
  return collisions;
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 建立新燈具預設值(置中房間) */
export function makeDefaultFixture(
  kind: FixtureKind,
  L: number,
  S: number,
  index: number,
): Fixture {
  return {
    id: `f-${Date.now()}-${index}`,
    kind,
    label: "",
    xCm: L / 2,
    zCm: S / 2,
    rCm: FIXTURE_KIND_DEFAULT_R[kind],
  };
}
