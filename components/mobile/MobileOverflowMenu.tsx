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
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1 rounded-full bg-zinc-300" />
        </div>
        <ul className="py-2">
          {items.map((it) => (
            <li key={it.label}>
              {it.href ? (
                <Link
                  href={it.href}
                  onClick={onClose}
                  className="flex items-center min-h-[48px] px-5 text-base text-zinc-800 hover:bg-zinc-50"
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
                  className="w-full flex items-center min-h-[48px] px-5 text-base text-zinc-800 hover:bg-zinc-50 text-left"
                >
                  {it.label}
                </button>
              )}
            </li>
          ))}
          <li>
            <InstallAppButton onDone={onClose} />
          </li>
        </ul>
      </div>
    </>
  );
}
