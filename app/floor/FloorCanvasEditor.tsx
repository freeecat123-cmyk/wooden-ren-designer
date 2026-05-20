"use client";

/**
 * 格線畫布房間編輯器:顯示房間正交多邊形,拖角點微調。
 * 角點吸附格線(預設 10cm)。拖動後即時把更新後的 RoomPolygon 回拋。
 *
 * v1 只支援「拖角點」與「吸附格線」;加/刪角點留待後續迭代。
 * 為維持正交不變量:拖某角點時,與它相鄰的兩角點各自跟著對齊
 *(共用水平邊的角點同步 y,共用垂直邊的角點同步 x)。
 */
import { useRef, useState } from "react";
import type { Point, RoomPolygon } from "@/lib/floor/types";
import { boundingBox } from "@/lib/floor/geometry";

interface Props {
  room: RoomPolygon;
  onChange: (room: RoomPolygon) => void;
  gridCm?: number;
  width?: number;
}

export function FloorCanvasEditor({
  room,
  onChange,
  gridCm = 10,
  width = 460,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const bb = boundingBox(room);
  const pad = 24;
  // 真.比例渲染:固定 cm→px 尺度 → 改寬只動寬、改深只動深,房間維持真實比例。
  // 房間任一軸超過 REF_CM 才整體縮小以塞進畫布(避免溢出)。
  const REF_CM = 700;
  const extX = Math.max(bb.maxX - bb.minX, 1);
  const extY = Math.max(bb.maxY - bb.minY, 1);
  const inner = width - pad * 2;
  const scale = Math.min(inner / REF_CM, inner / Math.max(extX, extY));
  const svgW = extX * scale + pad * 2;
  const svgH = extY * scale + pad * 2;
  const tx = (x: number) => (x - bb.minX) * scale + pad;
  const ty = (y: number) => (y - bb.minY) * scale + pad;
  const snap = (v: number) => Math.round(v / gridCm) * gridCm;

  function pointerToRoom(e: React.PointerEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: snap((e.clientX - rect.left - pad) / scale + bb.minX),
      y: snap((e.clientY - rect.top - pad) / scale + bb.minY),
    };
  }

  function handleMove(e: React.PointerEvent) {
    if (dragIdx == null) return;
    const np = pointerToRoom(e);
    const v = room.vertices.map((p) => ({ ...p }));
    const n = v.length;
    const prev = (dragIdx - 1 + n) % n;
    const next = (dragIdx + 1) % n;
    // 維持正交:與 prev 共用的邊、與 next 共用的邊
    // 判斷被拖角點原本與 prev 是水平或垂直邊
    const prevHoriz = Math.abs(v[dragIdx].y - v[prev].y) < 0.001;
    v[dragIdx] = np;
    if (prevHoriz) {
      v[prev].y = np.y; // 與 prev 共用水平邊 → 同步 y
      v[next].x = np.x; // 與 next 共用垂直邊 → 同步 x
    } else {
      v[prev].x = np.x;
      v[next].y = np.y;
    }
    onChange({ vertices: v });
  }

  return (
    <svg
      ref={svgRef}
      width={svgW}
      height={svgH}
      className="touch-none rounded border border-zinc-200 bg-white"
      onPointerMove={handleMove}
      onPointerUp={() => setDragIdx(null)}
      onPointerLeave={() => setDragIdx(null)}
    >
      {/* 格線 */}
      {Array.from({ length: Math.floor(extX / gridCm) + 1 }).map((_, i) => {
        const x = tx(bb.minX + i * gridCm);
        return (
          <line key={`v${i}`} x1={x} y1={pad} x2={x} y2={svgH - pad} stroke="#eee" />
        );
      })}
      {Array.from({ length: Math.floor(extY / gridCm) + 1 }).map((_, i) => {
        const y = ty(bb.minY + i * gridCm);
        return (
          <line key={`h${i}`} x1={pad} y1={y} x2={svgW - pad} y2={y} stroke="#eee" />
        );
      })}
      {/* 房間外框 */}
      <path
        d={
          room.vertices
            .map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`)
            .join(" ") + " Z"
        }
        fill="#bd995522"
        stroke="#bd9955"
        strokeWidth={2}
      />
      {/* 角點 */}
      {room.vertices.map((p, i) => (
        <circle
          key={i}
          cx={tx(p.x)}
          cy={ty(p.y)}
          r={7}
          fill="#fff"
          stroke="#8a6d3b"
          strokeWidth={2}
          className="cursor-grab"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            setDragIdx(i);
          }}
        />
      ))}
    </svg>
  );
}
