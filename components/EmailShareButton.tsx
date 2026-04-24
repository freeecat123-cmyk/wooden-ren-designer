"use client";

interface Props {
  toEmail: string;
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
  printPath: string;
  /** 公司名，當作署名；可空 */
  senderName?: string;
}

function twd(n: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/**
 * 產生 mailto: 連結寄報價單。
 * 按下打開使用者的郵件客戶端，主旨/正文自動填好，客戶只需加 attachment 或確認內容。
 */
export function EmailShareButton({
  toEmail,
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
  senderName,
}: Props) {
  const hasEmail = toEmail && toEmail.includes("@");

  const handleClick = () => {
    if (!hasEmail) {
      alert("客戶還沒填 Email。請在下方「客戶資料」欄填入 email 後再試。");
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const printUrl = origin + printPath;
    const hasSplit = depositRate > 0 && depositRate < 1;
    const greeting = customerName ? `${customerName} 您好，` : "您好，";
    const subject = `客製家具報價 ${quoteNo}｜${furnitureName} ${dimensions}`;
    const body = [
      greeting,
      ``,
      `感謝您的詢問，以下是您的客製家具報價：`,
      ``,
      `━━━━━━━━━━━━━━━`,
      `品項：${furnitureName}`,
      `尺寸：${dimensions}`,
      `木材：${materialName}`,
      ``,
      `報價總計（含稅）：${twd(total)}`,
      ...(hasSplit
        ? [
            `　訂金（下訂時付 ${Math.round(depositRate * 100)}%）：${twd(depositAmount)}`,
            `　尾款（交貨時付）：${twd(balanceAmount)}`,
          ]
        : []),
      ``,
      `預計交期：${deliveryDate}`,
      `報價有效至：${expiryDate}`,
      `━━━━━━━━━━━━━━━`,
      ``,
      `完整報價單（含三視圖、條款、備註）請點：`,
      printUrl,
      ``,
      `若需調整設計或有任何問題，歡迎回信討論。`,
      ``,
      `報價單號：${quoteNo}`,
      ``,
      senderName ? `— ${senderName}` : `— 木頭仁木作`,
    ].join("\n");

    const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`px-4 py-2 rounded text-sm text-white ${
        hasEmail
          ? "bg-sky-600 hover:bg-sky-700"
          : "bg-sky-300 hover:bg-sky-400"
      }`}
      title={hasEmail ? `寄報價單給 ${toEmail}` : "請先填客戶 Email"}
    >
      📧 寄 Email
    </button>
  );
}
