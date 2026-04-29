"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { FloorplanDesignRow, RoomDimensions } from "@/lib/floorplan/types";

const FloorplanCanvas = dynamic(() => import("./FloorplanCanvas").then((m) => m.FloorplanCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center text-sm text-zinc-400">
      載入畫布中...
    </div>
  ),
});

interface Props {
  initialDesigns: FloorplanDesignRow[];
  isLoggedIn: boolean;
}

const DEFAULT_ROOM: RoomDimensions = { lengthMm: 4000, widthMm: 3000 };

export function FloorplanClient({ initialDesigns, isLoggedIn }: Props) {
  const [room, setRoom] = useState<RoomDimensions>(DEFAULT_ROOM);

  const designs = useMemo(() => initialDesigns, [initialDesigns]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">室內配置 <span className="text-xs font-normal text-amber-400">Beta</span></h1>
          <span className="text-xs text-zinc-500">Phase 1 · 矩形房間 + 家具拖放（驗證版）</span>
        </div>
        <div className="flex items-center gap-2">
          <RoomInput
            label="長"
            valueMm={room.lengthMm}
            onChange={(v) => setRoom((r) => ({ ...r, lengthMm: v }))}
          />
          <RoomInput
            label="寬"
            valueMm={room.widthMm}
            onChange={(v) => setRoom((r) => ({ ...r, widthMm: v }))}
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            我的櫃子
          </div>
          <div className="flex-1 overflow-y-auto">
            {!isLoggedIn ? (
              <div className="p-4 text-sm text-zinc-400">
                請先<Link href="/auth/login" className="text-amber-400 hover:underline">登入</Link>，才能讀取你存的設計。
              </div>
            ) : designs.length === 0 ? (
              <div className="p-4 text-sm text-zinc-400">
                還沒有存任何設計。
                <Link href="/design/cabinet" className="ml-1 text-amber-400 hover:underline">
                  去設計一個
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {designs.map((d) => (
                  <DesignListItem key={d.id} design={d} />
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-500">
            通用家具 icon · W3 加入
          </div>
        </aside>

        <main className="flex-1 overflow-hidden bg-zinc-900/50">
          <FloorplanCanvas room={room} />
        </main>
      </div>
    </div>
  );
}

function RoomInput({
  label,
  valueMm,
  onChange,
}: {
  label: string;
  valueMm: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-zinc-400">
      {label}
      <input
        type="number"
        step={100}
        min={1000}
        max={20000}
        value={valueMm}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v > 0) onChange(v);
        }}
        className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-right text-zinc-100 focus:border-amber-500 focus:outline-none"
      />
      <span>mm</span>
    </label>
  );
}

function DesignListItem({ design }: { design: FloorplanDesignRow }) {
  const length = (design.params?.length as number) ?? null;
  const width = (design.params?.width as number) ?? null;
  const height = (design.params?.height as number) ?? null;
  const sizeText =
    length && width && height ? `${length} × ${width} × ${height} mm` : design.furniture_type;
  return (
    <li className="px-3 py-2 hover:bg-zinc-800/60">
      <div className="text-sm text-zinc-100">{design.name ?? "未命名設計"}</div>
      <div className="text-[11px] text-zinc-500">{sizeText}</div>
    </li>
  );
}
