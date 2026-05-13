"use client";

import Link from "next/link";

interface MobileTopBarProps {
  /** 家具中文名，如「方凳」 */
  title: string;
  /** 返回連結（通常是 /） */
  backHref: string;
  /** 點 ⋯ 觸發 overflow menu */
  onOverflow: () => void;
}

export function MobileTopBar({ title, backHref, onOverflow }: MobileTopBarProps) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-zinc-200">
      <div className="flex items-center justify-between min-h-[56px] px-3">
        <Link
          href={backHref}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:text-zinc-900"
          aria-label="返回"
        >
          ←
        </Link>
        <h1 className="text-base font-semibold text-zinc-900 truncate">{title}</h1>
        <button
          type="button"
          onClick={onOverflow}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:text-zinc-900"
          aria-label="更多動作"
        >
          ⋯
        </button>
      </div>
    </div>
  );
}
