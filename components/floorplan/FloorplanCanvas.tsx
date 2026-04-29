"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import type Konva from "konva";
import type { PlacedItem, RoomDimensions } from "@/lib/floorplan/types";
import { clampToRoom, getFootprint, snapToWalls } from "@/lib/floorplan/geometry";

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

  const stroke = isOverlapping ? "#f43f5e" : isSelected ? "#f59e0b" : "#52525b";
  const fill = isOverlapping ? "#fecdd3" : isSelected ? "#fde68a" : "#e4e4e7";

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
      <Rect width={wPx} height={hPx} fill={fill} stroke={stroke} strokeWidth={isSelected || isOverlapping ? 2 : 1} />
      <Line points={[0, 0, wPx, 0]} stroke={stroke} strokeWidth={3} />
      <Text
        x={4}
        y={4}
        width={wPx - 8}
        text={item.name}
        fontSize={11}
        fill="#27272a"
        ellipsis
        wrap="none"
      />
      <Text
        x={4}
        y={hPx - 16}
        width={wPx - 8}
        text={`${footW}×${footH}`}
        fontSize={10}
        fill="#52525b"
      />
    </Group>
  );
}
