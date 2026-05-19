"use client";

import { useState } from "react";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** 家具分類 id（pencil-holder, dovetail-box, ...） */
  furnitureType: string;
  /** 顯示用名稱（例：「筆筒 80×80×110」） */
  defaultName: string;
  /** 完整設計參數，會塞進 designs.params jsonb */
  params: Record<string, unknown>;
}

export function SaveDesignButton({ furnitureType, defaultName, params }: Props) {
  const { features, userId, isLoggedIn, isLoading } = useUserPlan();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="px-3 py-1.5 bg-zinc-200 text-zinc-500 rounded text-xs cursor-wait"
      >
        💾 載入中…
      </button>
    );
  }

  const handleSave = async () => {
    setMsg(null);
    if (!isLoggedIn || !userId) {
      setMsg({
        kind: "warn",
        text: "請先登入才能儲存設計（右上角點「使用 Google 登入」）",
      });
      return;
    }

    setBusy(true);
    try {
      // 算同類別流水號做預設名稱(只 read,沒有 mutation,保留 client 查)
      const supabase = createClient();
      const { count: typeCount } = await supabase
        .from("designs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("furniture_type", furnitureType);
      const nextSerial = (typeCount ?? 0) + 1;
      const padded = String(nextSerial).padStart(3, "0");
      const suggestedName = `${defaultName} #${padded}`;
      const name = window.prompt(
        `設計名稱（流水號自動建議，可改）`,
        suggestedName,
      );
      if (name === null) return; // 取消
      const finalName = name.trim() || suggestedName;

      // 改走 server API:plan / category / count 全部 server-side enforce,
      // 不再 client 直 insert(audit #18 hardening,擋 DevTools 直插 wardrobe 等)
      const res = await fetch("/api/designs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ furnitureType, name: finalName, params }),
      });
      const json = (await res.json()) as { error?: string; message?: string; max?: number; count?: number };
      if (!res.ok) {
        if (json.error === "max_designs_reached") {
          const max = json.max ?? features.maxDesigns;
          const count = json.count ?? 0;
          setMsg({
            kind: "warn",
            text: `免費版只能儲存 ${max} 件設計(你已有 ${count} 件)。升級個人版可儲存無限件,去 /pricing 看看～`,
          });
          return;
        }
        if (json.error === "plan_locked_category") {
          setMsg({
            kind: "warn",
            text: json.message ?? "此家具範本需付費方案,去 /pricing 看看～",
          });
          return;
        }
        if (json.error === "unauthenticated") {
          setMsg({ kind: "warn", text: "請先登入(session 可能過期)" });
          return;
        }
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      }

      setMsg({ kind: "ok", text: "✅ 已儲存到你的設計" });
    } catch (e) {
      setMsg({
        kind: "err",
        text: `儲存失敗：${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="max-md:min-h-[44px] px-3 py-1.5 bg-amber-700 text-white rounded text-xs hover:bg-amber-800 disabled:opacity-50"
        title={
          isLoggedIn
            ? `儲存到你的設計（${features.maxDesigns === Infinity ? "無上限" : `上限 ${features.maxDesigns} 件`}）`
            : "請先登入"
        }
      >
        {busy ? "儲存中…" : "💾 儲存設計"}
      </button>
      {msg && (
        <p
          className={`text-[11px] max-w-[220px] text-right ${
            msg.kind === "ok"
              ? "text-emerald-700"
              : msg.kind === "warn"
              ? "text-amber-700"
              : "text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
