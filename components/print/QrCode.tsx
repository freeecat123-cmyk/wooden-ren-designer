"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  /** QR 編碼的目標 URL；留空則用 window.location.href（當前頁面） */
  url?: string;
  /** 像素邊長，預設 120 */
  size?: number;
  /** 下方顯示短網址，預設 true */
  showCaption?: boolean;
}

/**
 * 列印頁用 QR code — 客戶掃碼直接跳到線上報價，看彩色 3D/三視圖。
 * 走 client component 是為了能抓 window.location.href（server 不知道 host）。
 */
export function QrCode({ url, size = 120, showCaption = true }: Props) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [target, setTarget] = useState<string>("");

  useEffect(() => {
    const finalUrl = url ?? window.location.href;
    setTarget(finalUrl);
    QRCode.toDataURL(finalUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 2, // 2x for sharp print
      color: { dark: "#18181b", light: "#ffffff" },
    })
      .then((d) => setDataUrl(d))
      .catch(() => setDataUrl(""));
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[9px] text-zinc-400"
      >
        QR…
      </div>
    );
  }

  // 簡短顯示 host（不含 query）
  let host = "";
  try {
    const u = new URL(target);
    host = u.host;
  } catch {}

  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={dataUrl}
        alt="掃碼看線上報價"
        width={size}
        height={size}
        className="block"
      />
      {showCaption && (
        <div className="text-[8px] text-zinc-500 text-center leading-tight">
          <div className="font-medium">📱 掃碼看線上報價</div>
          {host && <div className="font-mono text-zinc-400">{host}</div>}
        </div>
      )}
    </div>
  );
}
