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
import { OrthoView, mirrorYPart } from "@/lib/render/svg-views";
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
  /** 圖紙標題欄/比例文字語言;預設 zh-TW */
  locale?: string;
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
  locale = "zh-TW",
}: PaperSheetProps) {
  const isEn = locale === "en";
  const scaleLabel = isEn ? `Scale 1:${scale}` : `比例 1:${scale}`;
  const headerCols = isEn
    ? ["Part #", "Name", "Material", "Qty", "Scale", "Size (mm)"]
    : ["件號", "件名", "材料", "數量", "比例", "尺寸 mm"];
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

  // L 佈局 bbox（user 2026-05-28 移除俯視 TOP，剩 FRONT/SIDE/BOTTOM 三視）
  // 寬：左半 fW（front/bottom 對齊）+ 右半 sW（side） + 中間 gap
  // 高：front + bottom 兩層垂直堆疊（少一層 tH 跟一個 gap）
  const lLayoutW = fW + sW + gap + padPaper * 4;
  const lLayoutH = fH + tH + gap + padPaper * 4;
  // 置中於 inner drawing area（不夠時 clamp 0）
  const offX = Math.max(0, (innerW - lLayoutW) / 2);
  const offY = Math.max(0, (innerH - lLayoutH) / 2);
  const baseX = innerX + offX + padPaper;
  const baseY = innerY + offY + padPaper;

  // L 佈局 viewport（紙面 A4 mm 座標）— 加 chain padding,viewport 包含 silhouette
  // ± padPaper 的空間,讓 dim chain 不會溢出到鄰居 view
  const frontVp = {
    x: baseX,
    y: baseY,
    w: fW,
    h: fH,
  };
  const sideVp = {
    x: baseX + fW + padPaper + gap + padPaper,
    y: frontVp.y,
    w: sW,
    h: fH,
  };
  // 仰視 BOTTOM viewport：放在 frontVp 下方（第三角法慣例：仰視在正視下）
  // 寬高 = fW × tH，X 對齊 frontVp 讓「長 425」與正視共用對位線
  const bottomVp = {
    x: baseX,
    y: frontVp.y + fH + padPaper + gap + padPaper,
    w: fW,
    h: tH,
  };

  // 共用 overlay slot fragment（與 PartDrawing 的 overlay 一致）
  // 仰視 BOTTOM：annotation 用 Y 鏡像 part + 'top' view 渲染，跟 OrthoView 鏡像 silhouette 對位
  const overlayContent = (view: "front" | "top" | "side" | "bottom") => (ctx: any) => {
    const annPart = view === "bottom" ? mirrorYPart(part) : part;
    const annView: "front" | "top" | "side" = view === "bottom" ? "top" : view;
    // splay 腳零件圖 TOP 俯視看不到任何 mortise(都打在側面、從正上方俯視只看到斜頂面投影、
    // 沒有 entry face 朝鏡頭)。user 2026-05-27:「俯視圖看不到榫孔 不需要標」。
    // 用 raw view 區分:TOP=raw "top"、BOTTOM=raw "bottom"(annView 都會 collapse 成 "top"),
    // 只對真實 TOP 把 part.mortises 清空,BOTTOM 仰視仍保留全部 mortise。
    const isSplayFamily =
      annPart.shape?.kind === "splayed" ||
      annPart.shape?.kind === "splayed-tapered" ||
      annPart.shape?.kind === "splayed-round-tapered";
    const t2Part = view === "top" && isSplayFamily
      ? { ...annPart, mortises: [] }
      : annPart;
    return (
      <>
        <T1Dimensions ctx={ctx} part={annPart} view={annView} />
        <T2Annotations ctx={ctx} part={t2Part} view={annView} />
        <GrainArrow ctx={ctx} part={annPart} view={annView} />
        <ChamferRoundAnnotation ctx={ctx} part={annPart} view={annView} />
        <FacingMark ctx={ctx} part={annPart} view={annView} />
        <ShapeSpecificAnnotation ctx={ctx} part={annPart} view={annView} />
        <CompoundMiterAnnotation ctx={ctx} part={annPart} view={annView} />
        <SawSetupTable ctx={ctx} part={annPart} view={annView} />
      </>
    );
  };

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
          {scaleLabel}
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
            { label: headerCols[0], value: partNo },
            { label: headerCols[1], value: title },
            { label: headerCols[2], value: materialLabel },
            { label: headerCols[3], value: `×${count}` },
            { label: headerCols[4], value: `1:${scale}` },
            { label: headerCols[5], value: dimsLabel },
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
        view="front"
        title="俯視"
        titleEn="TOP"
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
      {/* 仰視 BOTTOM：top view 的 Y 鏡像；annotation 用 mirrorYPart + 'top' 對位 */}
      <OrthoView
        design={design}
        view="bottom"
        title="正視"
        titleEn="FRONT"
        isolatePartId={part.id}
        showDimensions={false}
        embedded
        paperMode="a4-landscape"
        paperScale={scale}
        paperFrame={false}
        paperViewport={bottomVp}
        overlayContent={overlayContent("bottom")}
      />

      {/* View 標籤（每個 view 左上角加底色矩形）— 最後渲染，蓋在 annotation 之上 */}
      <g fontFamily="sans-serif">
        {([
          { label: "俯視 TOP", vp: frontVp },
          { label: "側視 SIDE", vp: sideVp },
          { label: "正視 FRONT", vp: bottomVp },
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
