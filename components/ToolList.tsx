import type { FurnitureDesign } from "@/lib/types";
import { deriveRequiredTools, type RequiredTool } from "@/lib/tools/derive";
import { buildShopUrl } from "@/lib/tools/utm";
import type { ToolCategory, ToolPriority } from "@/lib/tools/catalog";
import { toolName } from "@/lib/tools/catalog";

const CATEGORY_LABEL_ZH: Record<ToolCategory, string> = {
  chisel: "鑿刀",
  saw: "鋸",
  plane: "刨",
  measure: "量測",
  marking: "劃線",
  clamp: "夾具",
  sand: "砂磨",
  glue: "膠合",
  finish: "塗裝",
  power: "電動",
  hardware: "五金",
  sharpening: "磨刀",
};

const CATEGORY_LABEL_EN: Record<ToolCategory, string> = {
  chisel: "Chisel",
  saw: "Saw",
  plane: "Plane",
  measure: "Measure",
  marking: "Marking",
  clamp: "Clamp",
  sand: "Sanding",
  glue: "Glue",
  finish: "Finish",
  power: "Power tool",
  hardware: "Hardware",
  sharpening: "Sharpening",
};

const PRIORITY_LABEL_ZH: Record<ToolPriority, string> = {
  required: "必備工具",
  recommended: "建議工具",
  optional: "可選工具",
};

const PRIORITY_LABEL_EN: Record<ToolPriority, string> = {
  required: "Required",
  recommended: "Recommended",
  optional: "Optional",
};

const PRIORITY_BADGE: Record<ToolPriority, string> = {
  required: "bg-rose-100 text-rose-800",
  recommended: "bg-amber-100 text-amber-800",
  optional: "bg-zinc-100 text-zinc-700",
};

interface ToolListProps {
  design: FurnitureDesign;
  locale?: string;
}

export function ToolList({ design, locale = "zh-TW" }: ToolListProps) {
  const tools = deriveRequiredTools(design, locale);
  const isEn = locale === "en";
  const categoryLabel = isEn ? CATEGORY_LABEL_EN : CATEGORY_LABEL_ZH;
  const priorityLabel = isEn ? PRIORITY_LABEL_EN : PRIORITY_LABEL_ZH;
  const grouped: Record<ToolPriority, RequiredTool[]> = {
    required: [],
    recommended: [],
    optional: [],
  };
  for (const t of tools) grouped[t.priority].push(t);

  return (
    <div className="space-y-6">
      {(Object.keys(grouped) as ToolPriority[]).map((priority) => {
        const items = grouped[priority];
        if (items.length === 0) return null;
        return (
          <div
            key={priority}
            className="rounded-lg border border-zinc-200 bg-white overflow-hidden"
          >
            <div className="flex items-baseline justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
              <h3 className="font-semibold">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full mr-2 ${PRIORITY_BADGE[priority]}`}
                >
                  {priorityLabel[priority]}
                </span>
                <span className="text-zinc-500 text-sm font-normal">
                  {isEn ? `${items.length} items` : `共 ${items.length} 項`}
                </span>
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500 bg-zinc-50/50">
                <tr>
                  <th className="text-left px-4 py-2 font-normal">{isEn ? "Tool" : "工具"}</th>
                  <th className="text-left px-4 py-2 font-normal">{isEn ? "Use" : "用途"}</th>
                  <th className="text-right px-4 py-2 font-normal">{isEn ? "Price" : "價格"}</th>
                  <th className="text-right px-4 py-2 font-normal">{isEn ? "Shop" : "商城"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((rt) => (
                  <tr
                    key={rt.tool.id}
                    className="border-t border-zinc-100 align-top"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-zinc-900">
                        {toolName(rt.tool, locale)}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {categoryLabel[rt.tool.category]}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{rt.reason}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-700 tabular-nums">
                      {rt.tool.priceCached
                        ? `${isEn ? "TWD " : "NT$ "}${rt.tool.priceCached.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {rt.tool.shopUrl ? (
                        <a
                          href={buildShopUrl(rt.tool.shopUrl, design.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-900 hover:text-zinc-600 underline underline-offset-2 text-xs"
                        >
                          {isEn ? "View →" : "查看商品 →"}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">{isEn ? "Coming soon" : "尚未上架"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs text-zinc-500">
        {isEn
          ? "Shop links go to the Wooden Ren carpenter store (TWD, ships from Taiwan). Prices are cached — actual price on the store page wins."
          : "點選商品連結將前往木頭仁木匠商城。價格為快取，實際以商城頁面為準。"}
      </p>
    </div>
  );
}
