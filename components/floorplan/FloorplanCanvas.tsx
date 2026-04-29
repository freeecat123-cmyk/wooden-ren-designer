"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import type { RoomDimensions } from "@/lib/floorplan/types";

interface Props {
  room: RoomDimensions;
}

const PADDING_PX = 60;
const GRID_MM = 500;

export function FloorplanCanvas({ room }: Props) {
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
        <Stage width={size.w} height={size.h}>
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
            <Group>
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
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
}
