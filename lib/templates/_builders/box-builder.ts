/**
 * 盒形家具共用 builder——筆筒、托盤、鳩尾盒這類「底板 + 4 壁 (+ 選配蓋)」結構。
 *
 * 座標約定（跟其他 template 相同）：
 *   底板沿 XZ 平面攤平，4 壁躺平後 rotate 直立。
 *   前/後壁：rotation { x: π/2, y: 0, z: 0 }
 *   左/右壁：rotation { x: π/2, y: π/2, z: 0 }
 */

import type { JoineryType, MaterialId, Part } from "@/lib/types";

/** 鳩尾/指接的肩部留量（每邊各內縮 mm，避免邊角崩） */
const SHOULDER_INSET = 2;
/** 鳩尾在厚度方向的內縮（每邊各 mm） */
const DOVETAIL_THICKNESS_INSET = 1;
/** 母件 mortise origin 相對內壁的微推量（避免重疊問題） */
const MORTISE_OFFSET = 1;
/** 底板槽接時相對外壁的內縮量（底板小一圈裝進牆內側槽） */
export const BOTTOM_GROOVE_INSET = 4;

export interface BoxBuilderSpec {
  /** 外尺寸 */
  outerL: number;
  outerW: number;
  outerH: number;
  /** 4 壁厚 */
  wallT: number;
  /** 底板厚 */
  botT: number;
  /** 蓋板厚（0 = 無蓋） */
  lidT?: number;
  /** 主材 */
  material: MaterialId;
  /** 角接合方式：stub-joint（搭接）/ finger-joint（指接）/ dovetail（鳩尾）/ tongue-and-groove（槽接） */
  cornerJoinery: JoineryType;
  /** 底板裝法：grooved（鋸槽嵌入，底板比外壁小一圈） / floating（底板與外壁齊邊，靠膠合） */
  bottomFit?: "grooved" | "floating";
  /** 零件 id 前綴（避免不同盒型 id 撞到，預設 "" 即 bottom/wall-front…） */
  idPrefix?: string;
  /** 中文零件名前綴（"" 預設） */
  nameZhPrefix?: string;
}

export interface BoxBuilderResult {
  parts: Part[];
  innerL: number;
  innerW: number;
  wallH: number;
  warnings: string[];
}

/**
 * 建出底板 + 4 壁（+ 選配蓋）的零件陣列，自動加上跟 cornerJoinery 對應的
 * 公/母榫尺寸，並回傳基本的尺寸合理性檢查 warnings。
 */
export function buildBox(spec: BoxBuilderSpec): BoxBuilderResult {
  const {
    outerL,
    outerW,
    outerH,
    wallT,
    botT,
    lidT = 0,
    material,
    cornerJoinery,
    bottomFit = "grooved",
    idPrefix = "",
    nameZhPrefix = "",
  } = spec;

  const warnings: string[] = [];
  const wallH = outerH - botT - lidT;
  const innerL = outerL - 2 * wallT;
  const innerW = outerW - 2 * wallT;

  if (wallH <= 0) {
    warnings.push(
      `壁高 ≤ 0：總高 ${outerH}mm 扣掉底厚 ${botT}mm` +
        (lidT > 0 ? ` 與蓋厚 ${lidT}mm` : "") +
        `後沒有空間留給壁。請增加總高或減少底/蓋厚。`,
    );
  }
  if (innerL <= 0 || innerW <= 0) {
    warnings.push(
      `內部尺寸 ≤ 0：壁厚 ${wallT}mm × 2 已超過外尺寸 ${outerL}×${outerW}mm。` +
        `請減少壁厚。`,
    );
  }

  const id = (s: string) => (idPrefix ? `${idPrefix}-${s}` : s);
  const nm = (s: string) => `${nameZhPrefix}${s}`;

  const bottomLen = bottomFit === "grooved" ? outerL - 2 * BOTTOM_GROOVE_INSET : outerL;
  const bottomWid = bottomFit === "grooved" ? outerW - 2 * BOTTOM_GROOVE_INSET : outerW;

  const bottom: Part = {
    id: id("bottom"),
    nameZh: nm("底板"),
    material,
    grainDirection: "length",
    visible: { length: bottomLen, width: bottomWid, thickness: botT },
    origin: { x: 0, y: 0, z: 0 },
    tenons: [],
    mortises: [],
  };

  // --- 角接合的公/母 tenon/mortise 對 ---
  // 約定：長壁（前/後）扛公榫於 start/end；短壁（左/右）扛對應 mortise。
  const cornerTenonW = Math.max(1, wallH - 2 * SHOULDER_INSET);
  const cornerTenonT = Math.max(1, wallT - 2 * DOVETAIL_THICKNESS_INSET);

  const longWall = (suffix: "front" | "back", z: number): Part => ({
    id: id(`wall-${suffix}`),
    nameZh: nm(suffix === "front" ? "前壁" : "後壁"),
    material,
    grainDirection: "length",
    visible: { length: outerL, width: wallH, thickness: wallT },
    origin: { x: 0, y: botT, z },
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    tenons: [
      {
        position: "start",
        type: cornerJoinery,
        length: wallT,
        width: cornerTenonW,
        thickness: cornerTenonT,
      },
      {
        position: "end",
        type: cornerJoinery,
        length: wallT,
        width: cornerTenonW,
        thickness: cornerTenonT,
      },
    ],
    mortises: [],
  });

  const shortWall = (suffix: "left" | "right", x: number): Part => ({
    id: id(`wall-${suffix}`),
    nameZh: nm(suffix === "left" ? "左壁" : "右壁"),
    material,
    grainDirection: "length",
    visible: { length: innerW, width: wallH, thickness: wallT },
    origin: { x, y: botT, z: 0 },
    rotation: { x: Math.PI / 2, y: Math.PI / 2, z: 0 },
    tenons: [],
    mortises: [
      {
        origin: { x: 0, y: 0, z: -(innerW / 2 + MORTISE_OFFSET) },
        depth: wallT,
        length: cornerTenonW,
        width: cornerTenonT,
        through: cornerJoinery === "finger-joint" || cornerJoinery === "dovetail",
      },
      {
        origin: { x: 0, y: 0, z: innerW / 2 + MORTISE_OFFSET },
        depth: wallT,
        length: cornerTenonW,
        width: cornerTenonT,
        through: cornerJoinery === "finger-joint" || cornerJoinery === "dovetail",
      },
    ],
  });

  const halfWidth = outerW / 2 - wallT / 2;
  const halfLength = outerL / 2 - wallT / 2;

  const parts: Part[] = [
    bottom,
    longWall("front", -halfWidth),
    longWall("back", halfWidth),
    shortWall("left", -halfLength),
    shortWall("right", halfLength),
  ];

  if (lidT > 0) {
    parts.push({
      id: id("lid"),
      nameZh: nm("蓋板"),
      material,
      grainDirection: "length",
      visible: { length: outerL, width: outerW, thickness: lidT },
      origin: { x: 0, y: outerH - lidT, z: 0 },
      tenons: [],
      mortises: [],
    });
  }

  return { parts, innerL, innerW, wallH, warnings };
}
