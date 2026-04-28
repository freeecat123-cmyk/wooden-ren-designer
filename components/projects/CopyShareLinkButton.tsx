"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function CopyShareLinkButton({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const url = `${window.location.origin}/projects/${projectId}/quote`;
      await navigator.clipboard.writeText(url);
      const supabase = createClient();
      await supabase
        .from("projects")
        .update({ status: "sent" })
        .eq("id", projectId)
        .eq("status", "draft");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
    >
      {copied ? "✅ 已複製" : "🔗 複製分享連結"}
    </button>
  );
}
