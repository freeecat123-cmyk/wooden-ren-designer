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
        {/*
          ⛔ 這裡以前是 `pr-12`(48px)—— 用猜的固定值去閃避右上角那組 fixed 元件
             (mm|inch 切換 + 幣別 + 登入鈕,SiteHeader.tsx:52)。
             中文版剛好夠,**英文版那組更寬**(單位與幣別的英文字比中文長),
             實測 iPhone 390px 開 /en/design/chest-of-drawers:
             h1 佔 x=148–290,而右上那組佔 x=138–224 —— **直接蓋住家具名稱**。
             (2026-08-21 稽核發現。)

          ✅ 改法:不再猜寬度,而是讓標題**只佔左右兩側之間剩下的空間**:
             左邊 ⋯ 鈕已經在 flex 裡,右邊補一個與 fixed 那組等寬的佔位
             (用 min-w 保底 + max-w 讓長名稱自己 truncate)。
             這樣中英文都不會被蓋,名稱太長時是截斷而不是疊字。
        */}
        <h1 className="font-serif-tc text-base font-bold text-amber-950 truncate flex-1 text-center min-w-0">
          {title}
        </h1>
        {/* 右側佔位:留給 SiteHeader 那組 fixed 元件(單位切換 + 登入)。
            ⚠️ 不寫死寬度——那組的寬度隨語系變(英文比中文寬一倍),猜一個值必定有一邊錯。
            比例由**實測最寬的情況**回推:iPhone 390px 的英文版,
            那組(mm|inch 86px + 登入 78px + gap)含右邊距共約 187px = 48%。
            中文版較窄、留白多一點無妨;標題過長時是 truncate 而不是疊字。 */}
        <div aria-hidden className="shrink-0 basis-[48%]" />
      </div>
    </div>
  );
}
