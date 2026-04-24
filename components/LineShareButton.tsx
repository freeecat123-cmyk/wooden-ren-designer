"use client";

import { useState } from "react";

interface Props {
  customerName: string;
  furnitureName: string;
  dimensions: string;
  materialName: string;
  total: number;
  depositAmount: number;
  balanceAmount: number;
  depositRate: number;
  deliveryDate: string;
  expiryDate: string;
  quoteNo: string;
  /** print 頁的相對 URL（不含 origin）；點擊時會加上 window.location.origin */
  printPath: string;
}

function twd(n: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function LineShareButton({
  customerName,
  furnitureName,
  dimensions,
  materialName,
  total,
  depositAmount,
  balanceAmount,
  depositRate,
  deliveryDate,
  expiryDate,
  quoteNo,
  printPath,
}: Props) {
  const [copied, setCopied] = useState(false);

  const buildMessage = (): string => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const printUrl = origin + printPath;
    const greeting = customerName ? `${customerName} 您好，` : "您好，";
    const hasSplit = depositRate > 0 && depositRate < 1;
    const lines = [
      `【木頭仁客製家具報價】`,
      ``,
      greeting,
      `以下是您的報價資訊：`,
      ``,
      `📐 品項：${furnitureName}`,
      `📏 尺寸：${dimensions}`,
      `🪵 木材：${materialName}`,
      ``,
      `💰 報價總計（含稅）：${twd(total)}`,
      ...(hasSplit
        ? [
            `　├─ 訂金（下訂時付 ${Math.round(depositRate * 100)}%）：${twd(depositAmount)}`,
            `　└─ 尾款（交貨時付）：${twd(balanceAmount)}`,
          ]
        : []),
      ``,
      `📅 預計交期：${deliveryDate}`,
      `⏰ 報價有效至：${expiryDate}`,
      ``,
      `🔗 詳細報價單：`,
      printUrl,
      ``,
      `報價單號：${quoteNo}`,
      `如需調整或有問題歡迎回覆，謝謝！`,
      `— 木頭仁木作`,
    ];
    return lines.join("\n");
  };

  const handleCopy = async () => {
    const text = buildMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 退路：舊瀏覽器 / 非 https 環境
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`px-4 py-2 rounded text-sm transition-colors ${
        copied
          ? "bg-emerald-600 text-white"
          : "bg-green-500 text-white hover:bg-green-600"
      }`}
      title="複製格式化的 LINE 訊息，直接貼給客戶"
    >
      {copied ? "✅ 已複製到剪貼簿" : "💬 複製 LINE 訊息"}
    </button>
  );
}
