"use client";

import Link from "next/link";
import { InstallAppButton } from "@/components/InstallAppButton";

interface MobileOverflowMenuProps {
  open: boolean;
  onClose: () => void;
  cutPlanUrl: string;
  printUrl: string;
  onShareLink: () => void;
  onDownloadCsv: () => void;
}

export function MobileOverflowMenu({
  open,
  onClose,
  cutPlanUrl,
  printUrl,
  onShareLink,
  onDownloadCsv,
}: MobileOverflowMenuProps) {
  if (!open) return null;

  const items = [
    { label: "📐 裁切單", href: cutPlanUrl, action: null as null | (() => void) },
    { label: "📋 材料 CSV", href: null, action: onDownloadCsv },
    { label: "🔗 複製連結", href: null, action: onShareLink },
    { label: "🖨 列印 / PDF", href: printUrl, action: null },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-amber-900/15" />
        </div>
        <div className="px-5 pt-1 pb-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 tracking-wide">
            本頁更多動作
          </span>
        </div>
        <ul className="px-2 pb-3">
          {items.map((it) => (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  onClick={onClose}
                  className="flex items-center min-h-[50px] px-3 rounded-xl text-base text-zinc-800 hover:bg-amber-50 hover:text-amber-900 active:scale-[0.99] transition"
                >
                  {it.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    it.action?.();
                    onClose();
                  }}
                  className="w-full flex items-center min-h-[50px] px-3 rounded-xl text-base text-zinc-800 hover:bg-amber-50 hover:text-amber-900 active:scale-[0.99] transition text-left"
                >
                  {it.label}
                </button>
              )}
            </li>
          ))}
          <li className="mt-1 pt-1 border-t border-amber-900/10">
            <InstallAppButton onDone={onClose} />
          </li>
        </ul>
      </div>
    </>
  );
}
