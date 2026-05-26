"use client";

/**
 * <PartDrawingPaperSheet> — 1 張 A4 横式紙內塞 3 個 view，L 型佈局
 *
 * 正規 CNS/JIS/ASME 第三角法慣例：
 *   - 俯視 TOP 在上（與 FRONT 長對正）
 *   - 正視 FRONT 在中（主視圖）
 *   - 側視 SIDE 在右（與 FRONT 高平齊）
 *
 * 紙面分區（A4 297×210mm）：
 *   - title bar     y∈[0,20]
 *   - drawing area  x∈[10,287] y∈[24,180]（267×156mm）— 3 view 都在此區
 *   - title block   y∈[182,202]
 *
 * 3 view 共用同一比例 n（pickScaleForPaper 算）：
 *   - FRONT 寬 = xExt/n、高 = yExt/n
 *   - TOP   寬 = xExt/n、高 = zExt/n
 *   - SIDE  寬 = zExt/n、高 = yExt/n
 */

import React from "react";
import type { FurnitureDesign, Part } from "@/lib/types";
import { OrthoView } from "@/lib/render/svg-views";
import { L_LAYOUT_GAP, L_LAYOUT_CHAIN_PAD, getIsolatedExtents } from "./paper-fit";
import {
  T1Dimensions,
  T2Annotations,
  FacingMark,
  ShapeSpecificAnnotation,
  CompoundMiterAnnotation,
  GrainArrow,
  ChamferRoundAnnotation,
  SawSetupTable,
} from "./annotation";

export interface PaperSheetProps {
  design: FurnitureDesign;
  part: Part;
  /** PartDrawing 算好的件號 P-XX */
  partNo: string;
  /** 同型件數 */
  count: number;
  /** 比例分母（1, 2, 5, 10, 20） */
  scale: number;
  /** 材料 zh label */
  materialLabel: string;
  /** 尺寸 string "L×W×T" */
  dimsLabel: string;
  /** 主標題（件名）*/
  title: string;
  /** 是否畫投影輔助線（toggle，預設關） */
  showProjectionLines?: boolean;
  className?: string;
}

export function PartDrawingPaperSheet({
  design,
  part,
  partNo,
  count,
  scale,
  materialLabel,
  dimsLabel,
  title,
  showProjectionLines = false,
  className,
}: PaperSheetProps) {
  // 用 isolation 旋轉後的 extents（跟 svg-views.tsx isolation 邏輯一致）
  // 否則 layout 算出來的 viewport 跟實際渲染的 silhouette 對不上 → 標籤/silhouette 位置亂跑
  const we = getIsolatedExtents(part);
  // L 佈局 silhouette 尺寸（紙上 mm）
  const fW = we.xExt / scale;
  const fH = we.yExt / scale;
  const tH = we.zExt / scale;
  const sW = we.zExt / scale;

  // Dim chain 留白（紙上 mm）— 每個 view 周圍預留給 T1 全長 / T2 標
  const padPaper = L_LAYOUT_CHAIN_PAD / scale;

  // 紙面佈局
  const innerX = 10;
  const innerY = 24;
  const innerW = 267;
  const innerH = 156;
  const gap = L_LAYOUT_GAP;

  // L 佈局 bbox（包含兩端+中間 view 邊界共 4 條 chain pad）
  const lLayoutW = fW + sW + gap + padPaper * 4;
  const lLayoutH = tH + fH + gap + padPaper * 4;
  // 置中於 inner drawing area（不夠時 clamp 0）
  const offX = Math.max(0, (innerW - lLayoutW) / 2);
  const offY = Math.max(0, (innerH - lLayoutH) / 2);
  const baseX = innerX + offX + padPaper;
  const baseY = innerY + offY + padPaper;

  // L 佈局 viewport（紙面 A4 mm 座標）— 加 chain padding,viewport 包含 silhouette
  // ± padPaper 的空間,讓 dim chain 不會溢出到鄰居 view
  const topVp = {
    x: baseX,
    y: baseY,
    w: fW,
    h: tH,
  };
  const frontVp = {
    x: baseX,
    y: baseY + tH + padPaper + gap + padPaper,
    w: fW,
    h: fH,
  };
  const sideVp = {
    x: baseX + fW + padPaper + gap + padPaper,
    y: frontVp.y,
    w: sW,
    h: fH,
  };

  // ─── 端面 detail view（複斜腳專用，1:2 放大）─────────────────────────────
  // 觸發條件：splayed / splayed-tapered / splayed-round-tapered 且 dx 或 dz ≠ 0
  const splayShape =
    part.shape?.kind === "splayed" ||
    part.shape?.kind === "splayed-tapered" ||
    part.shape?.kind === "splayed-round-tapered"
      ? (part.shape as { dxMm: number; dzMm: number })
      : null;
  const showEndFaceDetail =
    splayShape !== null && (Math.abs(splayShape.dxMm) > 0.01 || Math.abs(splayShape.dzMm) > 0.01);

  // 端面 detail 幾何
  let endFaceDetail: null | {
    cx: number; cy: number; halfW: number; halfH: number;
    shearX: number; shearY: number;
    edgeW: number; edgeH: number;
    angleX: number; angleZ: number;
    detailScale: number;
    boxX: number; boxY: number; boxW: number; boxH: number;
  } = null;
  if (showEndFaceDetail && splayShape) {
    const L = part.visible.length;
    const W = part.visible.width;
    const T = part.visible.thickness;
    const dx = Math.abs(splayShape.dxMm);
    const dz = Math.abs(splayShape.dzMm);
    // 複斜角：αx = atan(dx / T) （沿 X 軸傾斜），αz = atan(dz / T)
    const angleX = Math.atan2(dx, T);
    const angleZ = Math.atan2(dz, T);
    // 端面真實尺寸（補償複斜傾角放大）
    const edgeW = W / Math.max(Math.cos(angleX), 1e-6); // 寬面（沿 X 量）
    const edgeH = L / Math.max(Math.cos(angleZ), 1e-6); // 窄面（沿 Z 量）
    // detail scale 1:2，紙上 mm = 真實 mm / 2
    const detailScale = 2;
    const halfW = (edgeW / detailScale) / 2;
    const halfH = (edgeH / detailScale) / 2;
    // shear（紙上 mm）— 用 dx/T、dz/T 比例形成 parallelogram
    const shearX = ((L / detailScale) / 2) * (dx / T); // L 向影響 X
    const shearY = ((W / detailScale) / 2) * (dz / T); // W 向影響 Y
    // detail box 放在 sideVp 下方，若不夠就放在右側
    const desiredW = Math.max(48, halfW * 2 + 24);
    const desiredH = Math.max(40, halfH * 2 + 22);
    // 優先放右下：x 從 sideVp 右側起算
    const sideRight = sideVp.x + sideVp.w + padPaper;
    const innerRight = innerX + innerW;
    let boxX: number;
    let boxY: number;
    if (innerRight - sideRight >= desiredW) {
      boxX = sideRight + 2;
      boxY = Math.min(sideVp.y + sideVp.h - desiredH, 180 - desiredH - 1);
    } else {
      // 放 sideVp 下方
      boxX = sideVp.x + (sideVp.w - desiredW) / 2;
      boxY = sideVp.y + sideVp.h + padPaper * 0.5;
      if (boxY + desiredH > 180) {
        // 最後 fallback：擠到 frontVp 右下角空白（很罕見）
        boxY = 180 - desiredH - 1;
      }
    }
    endFaceDetail = {
      cx: boxX + desiredW / 2,
      cy: boxY + desiredH / 2 + 2,
      halfW, halfH, shearX, shearY,
      edgeW, edgeH,
      angleX, angleZ,
      detailScale,
      boxX, boxY, boxW: desiredW, boxH: desiredH,
    };
  }

  // 共用 overlay slot fragment（與 PartDrawing 的 overlay 一致）
  const overlayContent = (view: "front" | "top" | "side") => (ctx: any) => (
    <>
      <T1Dimensions ctx={ctx} part={part} view={view} />
      <T2Annotations ctx={ctx} part={part} view={view} />
      <GrainArrow ctx={ctx} part={part} view={view} />
      <ChamferRoundAnnotation ctx={ctx} part={part} view={view} />
      <FacingMark ctx={ctx} part={part} view={view} />
      <ShapeSpecificAnnotation ctx={ctx} part={part} view={view} />
      <CompoundMiterAnnotation ctx={ctx} part={part} view={view} />
      <SawSetupTable ctx={ctx} part={part} view={view} />
    </>
  );

  return (
    <svg
      viewBox="0 0 297 210"
      preserveAspectRatio="xMidYMid meet"
      className={className ?? "bg-white w-full h-auto"}
    >
      {/* ─── A4 紙面 chrome（外框 + title bar + title block + 比例尺 + 投影符號）─── */}
      <g fontFamily="sans-serif">
        {/* A4 外框 */}
        <rect x={0.5} y={0.5} width={296} height={209} fill="none" stroke="#222" strokeWidth={0.5} />
        {/* Title bar 區（y 8~20） */}
        <line x1={10} x2={287} y1={20} y2={20} stroke="#222" strokeWidth={0.4} />
        <text x={12} y={16.5} fontSize={5} fontWeight={700} fill="#111">
          {title}
        </text>
        <text x={285} y={16.5} fontSize={4} fill="#444" textAnchor="end">
          比例 1:{scale}
        </text>
        {/* Drawing area 邊框（淺灰輔助） */}
        <rect
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          fill="none"
          stroke="#ddd"
          strokeWidth={0.2}
          strokeDasharray="1 1"
        />

        {/* View 標籤改在 SVG 尾端渲染（搬到 OrthoView 之後），確保標題不被
            annotation overlay（如 CompoundMiterAnnotation）覆蓋。
            user 2026-05-26 回報「正視 FRONT」「側視 SIDE」被蓋字。 */}

        {/* 投影輔助線 toggle */}
        {showProjectionLines && (
          <g stroke="#ccc" strokeWidth={0.15} strokeDasharray="2 2" fill="none">
            {/* FRONT ↔ TOP 對位（共用 X 軸範圍） */}
            <line x1={frontVp.x} y1={frontVp.y} x2={frontVp.x} y2={topVp.y + topVp.h} />
            <line x1={frontVp.x + fW} y1={frontVp.y} x2={frontVp.x + fW} y2={topVp.y + topVp.h} />
            {/* FRONT ↔ SIDE 對位（共用 Y 軸範圍） */}
            <line x1={frontVp.x + fW} y1={frontVp.y} x2={sideVp.x} y2={frontVp.y} />
            <line x1={frontVp.x + fW} y1={frontVp.y + fH} x2={sideVp.x} y2={frontVp.y + fH} />
          </g>
        )}

        {/* Title block 區（y 182~202）— 6 欄 */}
        <line x1={10} x2={287} y1={182} y2={182} stroke="#222" strokeWidth={0.5} />
        <rect x={10} y={182} width={277} height={20} fill="none" stroke="#222" strokeWidth={0.4} />
        {[1, 2, 3, 4, 5].map((i) => (
          <line
            key={i}
            x1={10 + (277 / 6) * i}
            x2={10 + (277 / 6) * i}
            y1={182}
            y2={202}
            stroke="#222"
            strokeWidth={0.3}
          />
        ))}
        {(() => {
          const colW = 277 / 6;
          const cols = [
            { label: "件號", value: partNo },
            { label: "件名", value: title },
            { label: "材料", value: materialLabel },
            { label: "數量", value: `×${count}` },
            { label: "比例", value: `1:${scale}` },
            { label: "尺寸 mm", value: dimsLabel },
          ];
          return cols.map((c, i) => {
            const cx = 10 + colW * i + colW / 2;
            return (
              <g key={i}>
                <text x={cx} y={189} fontSize={3} fill="#666" textAnchor="middle">
                  {c.label}
                </text>
                <text x={cx} y={198} fontSize={4.5} fontWeight={600} fill="#111" textAnchor="middle">
                  {c.value}
                </text>
              </g>
            );
          });
        })()}

        {/* 比例尺條 */}
        {(() => {
          const realMm = 50;
          const barMm = realMm / scale;
          if (barMm < 4 || barMm > 60) return null;
          const barX = 200;
          const barY = 178;
          return (
            <g>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <line
                  key={i}
                  x1={barX + (barMm * i) / 5}
                  x2={barX + (barMm * i) / 5}
                  y1={barY - (i % 5 === 0 ? 2 : 1)}
                  y2={barY}
                  stroke="#222"
                  strokeWidth={0.3}
                />
              ))}
              <line x1={barX} x2={barX + barMm} y1={barY} y2={barY} stroke="#222" strokeWidth={0.4} />
              <text x={barX} y={barY + 4} fontSize={2.8} fill="#444">
                0
              </text>
              <text x={barX + barMm} y={barY + 4} fontSize={2.8} fill="#444" textAnchor="end">
                {realMm}mm
              </text>
            </g>
          );
        })()}

        {/* 第三角法投影符號 */}
        <g>
          <circle cx={171} cy={190} r={2.5} fill="none" stroke="#333" strokeWidth={0.3} />
          <circle cx={171} cy={190} r={1.2} fill="none" stroke="#333" strokeWidth={0.3} />
          <path
            d={`M 175 192.5 L 175 187.5 L 180 188.5 L 180 191.5 Z`}
            fill="none"
            stroke="#333"
            strokeWidth={0.3}
          />
          <text x={168} y={185} fontSize={2.4} fill="#666">
            第三角法
          </text>
        </g>
      </g>

      {/* ─── 3 個內嵌 OrthoView（embedded mode，回 <g> 不是 <svg>） ─── */}
      <OrthoView
        design={design}
        view="top"
        title="俯視"
        titleEn="TOP"
        isolatePartId={part.id}
        showDimensions={false}
        embedded
        paperMode="a4-landscape"
        paperScale={scale}
        paperFrame={false}
        paperViewport={topVp}
        overlayContent={overlayContent("top")}
      />
      <OrthoView
        design={design}
        view="front"
        title="正視"
        titleEn="FRONT"
        isolatePartId={part.id}
        showDimensions={false}
        embedded
        paperMode="a4-landscape"
        paperScale={scale}
        paperFrame={false}
        paperViewport={frontVp}
        overlayContent={overlayContent("front")}
      />
      <OrthoView
        design={design}
        view="side"
        title="側視"
        titleEn="SIDE"
        isolatePartId={part.id}
        showDimensions={false}
        embedded
        paperMode="a4-landscape"
        paperScale={scale}
        paperFrame={false}
        paperViewport={sideVp}
        overlayContent={overlayContent("side")}
      />

      {/* ─── 端面 detail view（1:2 放大）── 複斜腳專用 ─── */}
      {endFaceDetail && (() => {
        const d = endFaceDetail;
        // Parallelogram 4 角（紙上 mm）—— shear 用 dx/dz 比例
        // 用 -halfW..+halfW（X 方向）、-halfH..+halfH（Y 方向）
        // shearX 影響 Y 軸方向的平行四邊形傾斜，shearY 影響 X 軸方向
        const p1 = { x: d.cx - d.halfW - d.shearX, y: d.cy - d.halfH - d.shearY };
        const p2 = { x: d.cx + d.halfW - d.shearX, y: d.cy - d.halfH + d.shearY };
        const p3 = { x: d.cx + d.halfW + d.shearX, y: d.cy + d.halfH + d.shearY };
        const p4 = { x: d.cx - d.halfW + d.shearX, y: d.cy + d.halfH - d.shearY };
        const angleXdeg = (d.angleX * 180 / Math.PI).toFixed(1);
        const angleZdeg = (d.angleZ * 180 / Math.PI).toFixed(1);
        return (
          <g fontFamily="sans-serif">
            {/* detail box 外框 */}
            <rect
              x={d.boxX}
              y={d.boxY}
              width={d.boxW}
              height={d.boxH}
              fill="#fff"
              stroke="#888"
              strokeWidth={0.3}
              strokeDasharray="2 1"
            />
            {/* 標題 */}
            <rect
              x={d.boxX}
              y={d.boxY}
              width={d.boxW}
              height={4.5}
              fill="#fef3c7"
              stroke="#888"
              strokeWidth={0.2}
            />
            <text
              x={d.boxX + d.boxW / 2}
              y={d.boxY + 3.4}
              fontSize={3}
              fontWeight={700}
              fill="#92400e"
              textAnchor="middle"
            >
              端面 A-A 1:{d.detailScale}（複斜切面）
            </text>
            {/* Parallelogram (端面真實形狀) */}
            <polygon
              points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
              fill="#fef9c3"
              stroke="#111"
              strokeWidth={0.4}
            />
            {/* 邊長標 — 寬面 (上邊 p1→p2) */}
            <text
              x={(p1.x + p2.x) / 2}
              y={(p1.y + p2.y) / 2 - 1.5}
              fontSize={2.6}
              fill="#111"
              textAnchor="middle"
            >
              寬 {d.edgeW.toFixed(1)}
            </text>
            {/* 邊長標 — 窄面 (右邊 p2→p3) */}
            <text
              x={(p2.x + p3.x) / 2 + 1.5}
              y={(p2.y + p3.y) / 2}
              fontSize={2.6}
              fill="#111"
              textAnchor="start"
            >
              窄 {d.edgeH.toFixed(1)}
            </text>
            {/* 角度標（兩個複斜軸角度，左下＋右上角落附近） */}
            <text
              x={p4.x - 1}
              y={p4.y + 3}
              fontSize={2.4}
              fill="#b45309"
              textAnchor="end"
            >
              αx={angleXdeg}°
            </text>
            <text
              x={p2.x + 1}
              y={p2.y - 1}
              fontSize={2.4}
              fill="#b45309"
              textAnchor="start"
            >
              αz={angleZdeg}°
            </text>
          </g>
        );
      })()}

      {/* View 標籤（每個 view 左上角加底色矩形）— 最後渲染，蓋在 annotation 之上 */}
      <g fontFamily="sans-serif">
        {([
          { label: "俯視 TOP", vp: topVp },
          { label: "正視 FRONT", vp: frontVp },
          { label: "側視 SIDE", vp: sideVp },
        ] as const).map((v, i) => {
          const labelX = v.vp.x - padPaper * 0.8;
          const labelY = v.vp.y - padPaper * 0.5;
          return (
            <g key={i}>
              <rect
                x={labelX}
                y={labelY - 4}
                width={28}
                height={5.2}
                fill="#f3f4f6"
                stroke="#999"
                strokeWidth={0.2}
              />
              <text
                x={labelX + 2}
                y={labelY - 0.3}
                fontSize={3.5}
                fontWeight={700}
                fill="#222"
              >
                {v.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
