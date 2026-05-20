"use client";

import { useState } from "react";

type TabId = "structure" | "style" | "joinery" | "scene";

interface AdvancedSheetProps {
  open: boolean;
  onClose: () => void;
  structureContent: React.ReactNode;
  styleContent: React.ReactNode;
  joineryContent: React.ReactNode;
  sceneContent: React.ReactNode;
}

const TAB_LABEL: Record<TabId, string> = {
  structure: "結構",
  style: "美學",
  joinery: "榫接",
  scene: "場景",
};

export function AdvancedSheet({
  open,
  onClose,
  structureContent,
  styleContent,
  joineryContent,
  sceneContent,
}: AdvancedSheetProps) {
  const [tab, setTab] = useState<TabId>("structure");

  if (!open) return null;

  const contentByTab: Record<TabId, React.ReactNode> = {
    structure: structureContent,
    style: styleContent,
    joinery: joineryContent,
    scene: sceneContent,
  };

  // 從 y=288 開始（TopBar 56 + 3D sticky 約 232），讓 3D 仍可見在上方。
  // 用 min(288px, 40dvh)：短螢幕（landscape / 鍵盤彈出）時改用 40dvh 避免 sheet 被推出視窗。
  return (
    <div
      className="fixed top-[min(288px,40dvh)] left-0 right-0 bottom-0 z-50 bg-white flex flex-col rounded-t-3xl border-t border-amber-900/10 shadow-[0_-6px_20px_rgba(120,80,20,0.15)]"
      role="dialog"
      aria-label="進階設定"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-amber-900/10 min-h-[52px]">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-500 hover:text-amber-800 hover:bg-amber-50 active:scale-95 transition"
          aria-label="關閉"
        >
          ✕
        </button>
        <h2 className="font-serif-tc text-base font-bold text-amber-950">⚙ 進階設定</h2>
        <div className="w-11" />
      </div>
      <div className="flex border-b border-amber-900/10 bg-amber-50/60">
        {(Object.keys(TAB_LABEL) as TabId[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 min-h-[48px] text-sm font-semibold transition-colors ${
              tab === t
                ? "text-amber-800 border-b-2 border-amber-700 bg-white"
                : "text-zinc-500 hover:text-amber-800"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {contentByTab[tab]}
      </div>
    </div>
  );
}
