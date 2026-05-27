"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface MobileTopBarProps {
  /** 家具中文名，如「方凳」 */
  title: string;
  /** 返回連結（通常是 /） */
  backHref: string;
  /** 點 ⋯ 觸發 overflow menu（設計頁專屬：裁切單/CSV/連結/列印） */
  onOverflow: () => void;
}

/**
 * 設計頁手機 TopBar。
 * 帳號選單（HeaderUser）由 app/layout.tsx 全域 fixed top-4 right-4 提供，
 * 此 TopBar 把 ⋯ 移到左側（next to ←），右側留白避開 fixed HeaderUser。
 */
export function MobileTopBar({ title, backHref, onOverflow }: MobileTopBarProps) {
  const t = useTranslations("mobile.topBar");
  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-amber-900/10 shadow-sm">
      <div className="flex items-center gap-1 min-h-[56px] px-2">
        <Link
          href={backHref}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-lg text-zinc-600 hover:text-amber-800 hover:bg-amber-50 active:scale-95 transition shrink-0"
          aria-label={t("back")}
        >
          ←
        </Link>
        <button
          type="button"
          onClick={onOverflow}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-lg text-zinc-600 hover:text-amber-800 hover:bg-amber-50 active:scale-95 transition shrink-0"
          aria-label={t("more")}
          title={t("moreTitle")}
        >
          ⋯
        </button>
        <h1 className="font-serif-tc text-base font-bold text-amber-950 truncate flex-1 text-center pr-12">
          {title}
        </h1>
      </div>
    </div>
  );
}
