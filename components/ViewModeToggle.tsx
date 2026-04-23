"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

/**
 * 客戶版 / 內部版 切換。兩種版本差異：
 *  - customer（預設）：隱藏成本明細表、只列總價
 *  - internal：完整成本拆解（材料/工資/塗裝/毛利 每一行）
 */
export function ViewModeToggle({
  current,
}: {
  current: "customer" | "internal";
}) {
  const sp = useSearchParams();
  const pathname = usePathname();

  const makeUrl = (mode: "customer" | "internal") => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    next.set("viewMode", mode);
    return `${pathname}?${next.toString()}`;
  };

  const pillBase =
    "px-3 py-1 text-xs rounded-md transition-colors border";
  const active =
    "bg-zinc-900 text-white border-zinc-900";
  const inactive =
    "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50";

  return (
    <div className="inline-flex gap-1 rounded-lg p-1 bg-zinc-100">
      <Link
        href={makeUrl("customer")}
        className={`${pillBase} ${
          current === "customer" ? active : inactive
        }`}
        scroll={false}
      >
        👤 客戶版
      </Link>
      <Link
        href={makeUrl("internal")}
        className={`${pillBase} ${
          current === "internal" ? active : inactive
        }`}
        scroll={false}
      >
        🔧 內部版
      </Link>
    </div>
  );
}
