"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { PlacedItem, RoomDimensions } from "@/lib/floorplan/types";
import { clampToRoom, getFootprint, snapToWalls } from "@/lib/floorplan/geometry";
import { buildDesignFromParams } from "@/lib/floorplan/buildDesign";
import { svgElementToDataUrl } from "@/lib/floorplan/svgIcon";
import { TopViewIcon } from "./TopViewIcon";

interface Props {
  room: RoomDimensions;
  items: PlacedItem[];
  selectedId: string | null;
  overlappingIds: Set<string>;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
}

const PADDING_PX = 60;
const GRID_MM = 500;

export function FloorplanCanvas({
  room,
  items,
  selectedId,
  overlappingIds,
  onSelect,
  onMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(() => {
    const availW = size.w - PADDING_PX * 2;
    const availH = size.h - PADDING_PX * 2;
    if (availW <= 0 || availH <= 0) return 0.05;
    return Math.min(availW / room.lengthMm, availH / room.widthMm);
  }, [size, room]);

  const roomW = room.lengthMm * scale;
  const roomH = room.widthMm * scale;
  const offsetX = (size.w - roomW) / 2;
  const offsetY = (size.h - roomH) / 2;

  const gridLines = useMemo(() => {
    const lines: Array<{ points: number[]; key: string }> = [];
    for (let x = 0; x <= room.lengthMm; x += GRID_MM) {
      const px = offsetX + x * scale;
      lines.push({ points: [px, offsetY, px, offsetY + roomH], key: `v${x}` });
    }
    for (let y = 0; y <= room.widthMm; y += GRID_MM) {
      const py = offsetY + y * scale;
      lines.push({ points: [offsetX, py, offsetX + roomW, py], key: `h${y}` });
    }
    return lines;
  }, [room, scale, offsetX, offsetY, roomW, roomH]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {size.w > 0 && (
        <Stage
          width={size.w}
          height={size.h}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
        >
          <Layer listening={false}>
            <Rect
              x={offsetX}
              y={offsetY}
              width={roomW}
              height={roomH}
              fill="#fafaf9"
              stroke="#27272a"
              strokeWidth={2}
            />
            {gridLines.map((l) => (
              <Line key={l.key} points={l.points} stroke="#e4e4e7" strokeWidth={1} />
            ))}
            <Text
              x={offsetX}
              y={offsetY - 24}
              width={roomW}
              align="center"
              text={`${room.lengthMm} mm`}
              fontSize={13}
              fill="#a1a1aa"
            />
            <Text
              x={offsetX - 50}
              y={offsetY + roomH / 2 - 8}
              width={40}
              align="right"
              text={`${room.widthMm} mm`}
              fontSize={13}
              fill="#a1a1aa"
            />
          </Layer>

          <Layer>
            {items.map((item) => (
              <FurnitureNode
                key={item.id}
                item={item}
                room={room}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
                isSelected={item.id === selectedId}
                isOverlapping={overlappingIds.has(item.id)}
                onSelect={() => onSelect(item.id)}
                onMove={onMove}
              />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

function useDataUrlImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const i = new window.Image();
    let cancelled = false;
    i.onload = () => {
      if (!cancelled) setImg(i);
    };
    i.onerror = () => {
      if (!cancelled) setImg(null);
    };
    i.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return img;
}

function FurnitureNode({
  item,
  room,
  scale,
  offsetX,
  offsetY,
  isSelected,
  isOverlapping,
  onSelect,
  onMove,
}: {
  item: PlacedItem;
  room: RoomDimensions;
  scale: number;
  offsetX: number;
  offsetY: number;
  isSelected: boolean;
  isOverlapping: boolean;
  onSelect: () => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
}) {
  const { w: footW, h: footH } = getFootprint(item);
  const wPx = footW * scale;
  const hPx = footH * scale;
  const xPx = offsetX + item.xMm * scale;
  const yPx = offsetY + item.yMm * scale;

  // 重建設計 → SVG → dataURL；只在 designParams / type 變動時重算（不隨拖動觸發）
  const iconUrl = useMemo(() => {
    const design = buildDesignFromParams(item.furnitureType, item.designParams);
    if (!design) return null;
    return svgElementToDataUrl(createElement(TopViewIcon, { design }));
  }, [item.furnitureType, item.designParams]);

  const iconImg = useDataUrlImage(iconUrl);

  // Native (未旋轉) 像素尺寸：Image 寬高永遠用 footprintMm.length × .width，旋轉靠 Konva
  const nativeWpx = item.footprintMm.length * scale;
  const nativeHpx = item.footprintMm.width * scale;

  // 旋轉後讓 bounding box 左上角落在 Group 本地原點 (0,0)
  // rot 0:   image at (0, 0)
  // rot 90:  image at (footprintW_visual_px, 0) = (hPx, 0)  ← bbox 寬 = native height
  // rot 180: image at (nativeWpx, nativeHpx)
  // rot 270: image at (0, nativeWpx)
  let imgX = 0;
  let imgY = 0;
  if (item.rotation === 90) {
    imgX = nativeHpx;
  } else if (item.rotation === 180) {
    imgX = nativeWpx;
    imgY = nativeHpx;
  } else if (item.rotation === 270) {
    imgY = nativeWpx;
  }

  const stroke = isOverlapping ? "#f43f5e" : isSelected ? "#f59e0b" : "transparent";

  return (
    <Group
      x={xPx}
      y={yPx}
      draggable
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      dragBoundFunc={(pos) => {
        const proposedXmm = (pos.x - offsetX) / scale;
        const proposedYmm = (pos.y - offsetY) / scale;
        const snapped = snapToWalls(item, room, proposedXmm, proposedYmm);
        const clamped = clampToRoom(item, room, snapped.x, snapped.y);
        return {
          x: offsetX + clamped.x * scale,
          y: offsetY + clamped.y * scale,
        };
      }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const xMm = (node.x() - offsetX) / scale;
        const yMm = (node.y() - offsetY) / scale;
        onMove(item.id, xMm, yMm);
      }}
    >
      {iconImg ? (
        <KonvaImage
          image={iconImg}
          x={imgX}
          y={imgY}
          width={nativeWpx}
          height={nativeHpx}
          rotation={item.rotation}
        />
      ) : (
        <Rect width={wPx} height={hPx} fill="#e4e4e7" stroke="#52525b" strokeWidth={1} />
      )}

      {/* 重疊 / 選取邊框 */}
      {(isSelected || isOverlapping) && (
        <Rect
          width={wPx}
          height={hPx}
          fill="transparent"
          stroke={stroke}
          strokeWidth={2}
          listening={false}
        />
      )}

      <Text
        x={4}
        y={4}
        width={wPx - 8}
        text={item.name}
        fontSize={11}
        fill="#27272a"
        ellipsis
        wrap="none"
        listening={false}
      />
      <Text
        x={4}
        y={hPx - 16}
        width={wPx - 8}
        text={`${footW}×${footH}`}
        fontSize={10}
        fill="#52525b"
        listening={false}
      />
    </Group>
  );
}
