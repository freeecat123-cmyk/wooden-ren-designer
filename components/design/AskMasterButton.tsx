"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { getTemplate } from "@/lib/templates";
import type { FurnitureCategory, MaterialId } from "@/lib/types";
import { MATERIALS } from "@/lib/materials";

/**
 * 把當前設計頁的家具參數整成一段中文問題，丟給 @woodenren_bot
 * （木工大師 skill 會自動 grep wood-master/knowledge 19 份檔回答）。
 *
 * 機制：
 * 1. 從 URL searchParams + 當前 category 拼問題字串
 * 2. 點按鈕 → 複製到剪貼簿 + 開新分頁到 Telegram
 * 3. 使用者貼到 bot 即可問
 *
 * 為什麼這樣設計：bot 一句話啟動門檻低、知識庫覆蓋深、不需要 wrd
 * 整合 LLM API。設計頁→bot 變成「問專業意見」入口，補強 UI 自動
 * 套參數做不到的「主觀建議 / 替代方案 / 工法選擇」。
 */
export function AskMasterButton({
  category,
  defaults,
}: {
  category: FurnitureCategory;
  defaults: { length: number; width: number; height: number };
}) {
  const sp = useSearchParams();
  const [copied, setCopied] = useState(false);

  const buildQuestion = (): string => {
    const tmpl = getTemplate(category);
    const tmplName = tmpl?.nameZh ?? category;

    const length = sp?.get("length") ?? defaults.length;
    const width = sp?.get("width") ?? defaults.width;
    const height = sp?.get("height") ?? defaults.height;
    const materialId = (sp?.get("material") ?? "douglas-fir") as MaterialId;
    const materialName = MATERIALS[materialId]?.nameZh ?? materialId;
    const legShape = sp?.get("legShape");
    const legSize = sp?.get("legSize");
    const apronWidth = sp?.get("apronWidth");
    const splayAngle = sp?.get("splayAngle");
    const backStyle = sp?.get("backStyle");
    const seatProfile = sp?.get("seatProfile");
    const joinery = sp?.get("joineryMode");

    const parts: string[] = [];
    parts.push(`我在做一個${tmplName}：`);
    parts.push(`尺寸 ${length} × ${width} × ${height}mm`);
    parts.push(`木種 ${materialName}`);
    if (legShape) parts.push(`腳形 ${legShape}${legSize ? ` ${legSize}mm` : ""}`);
    if (apronWidth) parts.push(`牙條高 ${apronWidth}mm`);
    if (splayAngle && splayAngle !== "0") parts.push(`外斜 ${splayAngle}°`);
    if (backStyle) parts.push(`椅背 ${backStyle}`);
    if (seatProfile && seatProfile !== "flat") parts.push(`座面 ${seatProfile}`);
    if (joinery === "true") parts.push("用榫卯接合");

    parts.push("");
    parts.push("這樣設計合理嗎？有什麼需要注意的、或可以更好的地方？");
    return parts.join("\n");
  };

  const handleClick = async () => {
    const question = buildQuestion();
    try {
      await navigator.clipboard.writeText(question);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // 剪貼簿 API 在某些瀏覽器禁用——fallback 用 prompt 顯示
      window.prompt("複製這段貼到木工大師 bot：", question);
    }
    // 開新分頁去 Telegram
    window.open("https://t.me/woodenren_bot", "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white text-zinc-800 ring-1 ring-zinc-300 hover:bg-emerald-50 hover:ring-emerald-400 transition"
      title="把當前設計參數複製成問題、開 Telegram，貼到 @woodenren_bot 問木工建議"
    >
      <span>💬</span>
      <span>{copied ? "✓ 已複製，到 Telegram 貼上" : "問木工大師"}</span>
    </button>
  );
}
