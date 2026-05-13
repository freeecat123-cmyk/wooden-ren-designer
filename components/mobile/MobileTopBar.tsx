"use client";

import Link from "next/link";
import { HeaderUser } from "@/components/auth/HeaderUser";

interface MobileTopBarProps {
  /** 家具中文名，如「方凳」 */
  title: string;
  /** 返回連結（通常是 /） */
  backHref: string;
  /** 點 ⋯ 觸發 overflow menu（設計頁專屬：裁切單/CSV/連結/列印） */
  onOverflow: () => void;
}

export function MobileTopBar({ title, backHref, onOverflow }: MobileTopBarProps) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-zinc-200">
      <div className="flex items-center gap-1 min-h-[56px] px-2">
        <Link
          href={backHref}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:text-zinc-900 shrink-0"
          aria-label="返回"
        >
          ←
        </Link>
        <h1 className="text-base font-semibold text-zinc-900 truncate flex-1 text-center">{title}</h1>
        <button
          type="button"
          onClick={onOverflow}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:text-zinc-900 shrink-0"
          aria-label="更多動作"
          title="本頁更多動作（裁切單 / CSV / 列印）"
        >
          ⋯
        </button>
        {/* 帳號選單：我的設計/專案/客戶/抬頭/訂閱/方案/後台/登出 */}
        <div className="shrink-0">
          <HeaderUser />
        </div>
      </div>
    </div>
  );
}
