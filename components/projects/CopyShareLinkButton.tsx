"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";

/**
 * 取得或生成這個專案的 share_token，並複製公開報價連結。
 * 順便把 status 從 draft 推到 sent（已寄提案）。
 */
export function CopyShareLinkButton({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: existing, error: readErr } = await supabase
        .from("projects")
        .select("share_token")
        .eq("id", projectId)
        .single();
      if (readErr) throw readErr;

      let token = existing?.share_token as string | null;
      if (!token) {
        token = nanoid(16);
        const { error: updErr } = await supabase
          .from("projects")
          .update({ share_token: token })
          .eq("id", projectId);
        if (updErr) throw updErr;
      }

      const url = `${window.location.origin}/projects/${projectId}/quote?token=${token}`;
      await navigator.clipboard.writeText(url);
      await supabase
        .from("projects")
        .update({ status: "sent" })
        .eq("id", projectId)
        .eq("status", "draft");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      window.alert(`複製失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="產生公開連結（客戶不需登入即可看到報價）"
      className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
    >
      {copied ? "✅ 已複製公開連結" : "🔗 複製公開連結"}
    </button>
  );
}
