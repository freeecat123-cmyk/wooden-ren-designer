"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { useBranding } from "@/components/branding/branding";
import { formatTWD } from "@/lib/pricing/catalog";

interface Props {
  projectId: string;
  quoteNo: string;
  customerName: string | null;
  projectName: string;
  total: number;
  /** 已是公開檢視（客戶開的連結）時提供現有 token，按鈕直接重用而不另寫 DB */
  token: string | null;
}

/**
 * 生成 LINE / Email 分享連結。木工點下去把報價單網址 + 一段招呼貼到對方收件匣。
 * 沒 share_token 時自動生一個寫回 DB；有就重用。
 */
export function ProjectQuoteShareActions({
  projectId,
  quoteNo,
  customerName,
  projectName,
  total,
  token,
}: Props) {
  const { data: branding } = useBranding();
  const [busy, setBusy] = useState(false);

  const ensureToken = async (): Promise<string | null> => {
    if (token) return token;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("projects")
        .select("share_token")
        .eq("id", projectId)
        .single();
      let t = (existing?.share_token as string | null) ?? null;
      if (!t) {
        t = nanoid(16);
        await supabase
          .from("projects")
          .update({ share_token: t })
          .eq("id", projectId);
      }
      return t;
    } catch (e) {
      window.alert(`產生連結失敗：${e instanceof Error ? e.message : String(e)}`);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const buildPublicUrl = (t: string) => {
    const base = branding.publicBaseUrl?.trim() || window.location.origin;
    return `${base}/projects/${projectId}/quote?token=${t}`;
  };

  const sender = branding.companyNameZh || "工作室";
  const greeting = customerName ? `${customerName} 您好，` : "您好，";

  const handleLine = async () => {
    const t = await ensureToken();
    if (!t) return;
    const url = buildPublicUrl(t);
    const text = `${greeting}\n\n${sender}為您準備的「${projectName}」整套報價單已完成（單號 ${quoteNo}，總計 ${formatTWD(total)}）。\n\n線上檢視：${url}\n\n如有任何問題或想調整內容，歡迎隨時聯絡，謝謝！`;
    const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
    window.open(lineUrl, "_blank", "noopener,noreferrer");
  };

  const handleEmail = async () => {
    const t = await ensureToken();
    if (!t) return;
    const url = buildPublicUrl(t);
    const subject = `${projectName} 報價單（${quoteNo}）— ${sender}`;
    const lines = [
      greeting,
      "",
      `感謝您的詢問。${sender}為您準備的「${projectName}」整套報價單已完成。`,
      "",
      `報價單號：${quoteNo}`,
      `整套金額：${formatTWD(total)}`,
      `線上檢視：${url}`,
      "",
      "如有任何問題或希望調整內容，歡迎回覆此信，謝謝！",
      "",
      sender,
    ];
    const body = lines.join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <>
      <button
        type="button"
        onClick={handleLine}
        disabled={busy}
        className="px-3 py-2 rounded text-sm bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
        title="開啟 LINE 分享面板，已預填招呼語與連結"
      >
        💬 LINE 提案
      </button>
      <button
        type="button"
        onClick={handleEmail}
        disabled={busy}
        className="px-3 py-2 rounded text-sm bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
        title="開啟 Email，已預填主旨與連結"
      >
        📧 寄 Email
      </button>
    </>
  );
}
