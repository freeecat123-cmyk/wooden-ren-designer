"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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

export function ProjectQuoteShareActions({
  projectId,
  quoteNo,
  customerName,
  projectName,
  total,
  token,
}: Props) {
  const t = useTranslations("projectShare");
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
      let tk = (existing?.share_token as string | null) ?? null;
      if (!tk) {
        tk = nanoid(16);
        await supabase
          .from("projects")
          .update({ share_token: tk })
          .eq("id", projectId);
      }
      return tk;
    } catch (e) {
      window.alert(
        t("alertGenerateFailedTpl", {
          msg: e instanceof Error ? e.message : String(e),
        }),
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const buildPublicUrl = (tk: string) => {
    const base = branding.publicBaseUrl?.trim() || window.location.origin;
    return `${base}/projects/${projectId}/quote?token=${tk}`;
  };

  const sender = branding.companyNameZh || t("studio");
  const greeting = customerName
    ? t("greetingTpl", { name: customerName })
    : t("greetingFallback");

  const handleLine = async () => {
    const tk = await ensureToken();
    if (!tk) return;
    const url = buildPublicUrl(tk);
    const text = t("lineMessageTpl", {
      greeting,
      sender,
      project: projectName,
      no: quoteNo,
      total: formatTWD(total),
      url,
    });
    const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
    window.open(lineUrl, "_blank", "noopener,noreferrer");
  };

  const handleEmail = async () => {
    const tk = await ensureToken();
    if (!tk) return;
    const url = buildPublicUrl(tk);
    const subject = t("emailSubjectTpl", {
      project: projectName,
      no: quoteNo,
      sender,
    });
    const lines = [
      greeting,
      "",
      t("emailIntroTpl", { sender, project: projectName }),
      "",
      t("emailQuoteNoTpl", { no: quoteNo }),
      t("emailTotalTpl", { total: formatTWD(total) }),
      t("emailUrlTpl", { url }),
      "",
      t("emailSignoff"),
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
        title={t("lineBtnTitle")}
      >
        {t("lineBtn")}
      </button>
      <button
        type="button"
        onClick={handleEmail}
        disabled={busy}
        className="px-3 py-2 rounded text-sm bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
        title={t("emailBtnTitle")}
      >
        {t("emailBtn")}
      </button>
    </>
  );
}
