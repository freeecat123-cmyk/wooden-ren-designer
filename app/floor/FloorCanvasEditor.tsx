"use client";

/**
 * 格線畫布房間編輯器:顯示房間多邊形,拖角點微調,並在每條邊中點標出長度。
 * 角點吸附格線(預設 10cm)。拖動後即時把更新後的 RoomPolygon 回拋。
 *
 * 邊長標籤 / 編輯輸入框都用 HTML 元素浮在 SVG 畫布上(絕對定位),不走 SVG
 * 的 pointer-events —— SVG <text>/<foreignObject> 的點擊與焦點判定不可靠。
 * 正交邊(水平/垂直)是 <button>,點了跳輸入框;斜邊(六角型)是純顯示 <span>。
 *
 * 維持正交不變量:拖某角點時,與它相鄰的兩角點各自跟著對齊(共用水平邊同步 y、
 * 共用垂直邊同步 x);若相鄰邊本身是斜邊,則該角點自由移動、不強制同步。
 */
import { useEffect, useRef, useState } from "react";
import type { Point, RoomPolygon } from "@/lib/floor/types";
import { boundingBox, pointInPolygon } from "@/lib/floor/geometry";

interface Props {
  room: RoomPolygon;
  onChange: (room: RoomPolygon) => void;
  gridCm?: number;
  width?: number;
}

const EPS = 0.001;
const MIN_EDGE_CM = 10;

export function FloorCanvasEditor({
  room,
  onChange,
  gridCm = 10,
  width = 460,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [editEdge, setEditEdge] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  // 容器實際渲染寬度（手機版 ~360px，桌機到 maxWidth=460），所有座標計算用這個
  const [boxW, setBoxW] = useState(width);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBoxW(el.clientWidth || width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const bb = boundingBox(room);
  const pad = 30;
  // 真.比例渲染:固定 cm→px 尺度 → 改寬只動寬、改深只動深,房間維持真實比例。
  // 房間任一軸超過 REF_CM 才整體縮小以塞進畫布(避免溢出)。
  const REF_CM = 700;
  const extX = Math.max(bb.maxX - bb.minX, 1);
  const extY = Math.max(bb.maxY - bb.minY, 1);
  const inner = boxW - pad * 2;
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
    const prevHoriz = Math.abs(v[dragIdx].y - v[prev].y) < EPS;
    const prevVert = Math.abs(v[dragIdx].x - v[prev].x) < EPS;
    const nextHoriz = Math.abs(v[dragIdx].y - v[next].y) < EPS;
    const nextVert = Math.abs(v[dragIdx].x - v[next].x) < EPS;
    v[dragIdx] = np;
    // 兩條相鄰邊都正交才同步;碰到斜邊則自由移動
    if ((prevHoriz || prevVert) && (nextHoriz || nextVert)) {
      if (prevHoriz) {
        v[prev].y = np.y;
        v[next].x = np.x;
      } else {
        v[prev].x = np.x;
        v[next].y = np.y;
      }
    }
    onChange({ vertices: v });
  }

  /** 把第 i 條邊(v[i]→v[i+1])的長度設成 L,維持正交。 */
  function applyEdgeLength(i: number, L: number) {
    const v = room.vertices.map((p) => ({ ...p }));
    const n = v.length;
    const a = v[i];
    const bi = (i + 1) % n;
    const ci = (i + 2) % n;
    const b = v[bi];
    const horiz = Math.abs(b.y - a.y) < EPS;
    const vert = Math.abs(b.x - a.x) < EPS;
    if (!horiz && !vert) return; // 斜邊不可編輯
    const len = Math.max(L, MIN_EDGE_CM);
    if (horiz) {
      const dir = b.x - a.x >= 0 ? 1 : -1;
      const newX = a.x + dir * len;
      const delta = newX - b.x;
      const c = v[ci];
      v[bi] = { x: newX, y: b.y };
      // 下一條邊 b→c 原為垂直 → c 同步 x,讓邊維持垂直
      if (Math.abs(c.x - b.x) < EPS) v[ci] = { x: c.x + delta, y: c.y };
    } else {
      const dir = b.y - a.y >= 0 ? 1 : -1;
      const newY = a.y + dir * len;
      const delta = newY - b.y;
      const c = v[ci];
      v[bi] = { x: b.x, y: newY };
      if (Math.abs(c.y - b.y) < EPS) v[ci] = { x: c.x, y: c.y + delta };
    }
    onChange({ vertices: v });
  }

  function commitEdit() {
    if (editEdge == null) return;
    const val = Number(draft);
    if (Number.isFinite(val) && val > 0) applyEdgeLength(editEdge, val);
    setEditEdge(null);
  }

  const verts = room.vertices;
  const n = verts.length;

  // 預先算好每條邊的標籤位置 / 長度 / 是否可編輯
  const labels = verts.map((a, i) => {
    const b = verts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenCm = Math.hypot(dx, dy);
    const editable = lenCm > EPS && (Math.abs(dx) < EPS || Math.abs(dy) < EPS);
    const nx = lenCm > EPS ? -dy / lenCm : 0;
    const ny = lenCm > EPS ? dx / lenCm : 0;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const inside = pointInPolygon({ x: mx + nx * 0.5, y: my + ny * 0.5 }, room);
    // 短邊（L/T/凸 凹陷處的內邊）label 推得更遠，避免在窄空間互相重疊
    const edgeLenPx = lenCm * scale;
    const offset = 16 + Math.max(0, (80 - edgeLenPx) / 3);
    const lx = tx(mx) + (inside ? -nx : nx) * offset;
    const ly = ty(my) + (inside ? -ny : ny) * offset;
    return { i, lenCm, editable, lx, ly };
  });
  const editing = editEdge != null ? labels[editEdge] : null;

  return (
    // SVG 對齊容器左上角（不能 flex-center，否則 HTML labels 用容器座標、SVG 視覺位置
    // 已被居中位移，labels 會浮到房間外面）。
    // boxW 由 ResizeObserver 抓真實寬度,labels HTML 浮層座標才能跟 SVG 一致
    <div
      ref={containerRef}
      className="relative rounded border border-zinc-200 bg-white overflow-hidden"
      style={{ width: "100%", maxWidth: width, height: svgH }}
    >
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        className="block touch-none"
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
            verts
              .map((p, i) => `${i ? "L" : "M"}${tx(p.x)} ${ty(p.y)}`)
              .join(" ") + " Z"
          }
          fill="#bd995522"
          stroke="#bd9955"
          strokeWidth={2}
        />
        {/* 角點 */}
        {verts.map((p, i) => (
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

      {/* 邊長標籤 — HTML 浮層,絕對定位疊在每條邊中點 */}
      {labels.map(({ i, lenCm, editable, lx, ly }) => {
        if (lenCm < EPS || editEdge === i) return null;
        const common =
          "absolute -translate-x-1/2 -translate-y-1/2 rounded bg-white px-1 text-[11px] font-semibold leading-[18px]";
        if (!editable) {
          return (
            <span
              key={`e${i}`}
              style={{ left: lx, top: ly }}
              className={`${common} text-zinc-400`}
            >
              {Math.round(lenCm)}
            </span>
          );
        }
        return (
          <button
            key={`e${i}`}
            type="button"
            style={{ left: lx, top: ly }}
            className={`${common} cursor-pointer text-[#8a6d3b] ring-1 ring-[#bd9955]/40 hover:bg-[#bd9955]/15`}
            onClick={() => {
              setDraft(String(Math.round(lenCm)));
              setEditEdge(i);
            }}
          >
            {Math.round(lenCm)}
          </button>
        );
      })}

      {/* 編輯輸入框 — HTML 浮層 */}
      {editing && (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditEdge(null);
          }}
          style={{
            position: "absolute",
            left: editing.lx,
            top: editing.ly,
            width: 56,
            height: 24,
            transform: "translate(-50%, -50%)",
          }}
          className="rounded border border-[#bd9955] bg-white text-center text-[11px] outline-none"
        />
      )}
    </div>
  );
}
