"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("saveDesign");
  const tPrompt = useTranslations("saveDesign.loginPrompt");
  const { features, userId, isLoggedIn, isLoading } = useUserPlan();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  if (isLoading) {
    return (
      <button
        type="button"
        disabled
        className="px-3.5 py-2 bg-zinc-200 text-zinc-500 rounded-lg text-xs cursor-wait"
      >
        {t("btnLoading")}
      </button>
    );
  }

  const handleSave = async () => {
    setMsg(null);
    if (!isLoggedIn || !userId) {
      setShowLoginPrompt(true);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { count: typeCount } = await supabase
        .from("designs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("furniture_type", furnitureType);
      const nextSerial = (typeCount ?? 0) + 1;
      const padded = String(nextSerial).padStart(3, "0");
      const suggestedName = `${defaultName} #${padded}`;
      const name = window.prompt(t("promptName"), suggestedName);
      if (name === null) return;
      const finalName = name.trim() || suggestedName;

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
            text: t("warnMaxDesignsTpl", { max, count }),
          });
          return;
        }
        if (json.error === "plan_locked_category") {
          setMsg({
            kind: "warn",
            text: json.message ?? t("warnPlanLockedFallback"),
          });
          return;
        }
        if (json.error === "unauthenticated") {
          setMsg({ kind: "warn", text: t("warnUnauth") });
          return;
        }
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      }

      setMsg({ kind: "ok", text: t("okSaved") });
    } catch (e) {
      setMsg({
        kind: "err",
        text: t("errSaveFailTpl", { msg: e instanceof Error ? e.message : String(e) }),
      });
    } finally {
      setBusy(false);
    }
  };

  const limitText =
    features.maxDesigns === Infinity
      ? t("tipLimitUnlimited")
      : t("tipLimitNTpl", { n: features.maxDesigns });

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        className="max-md:min-h-[44px] inline-flex items-center gap-1 px-3.5 py-2 bg-amber-700 text-white rounded-lg text-xs font-medium shadow-sm shadow-amber-900/20 hover:bg-amber-800 hover:shadow-md transition-all disabled:opacity-50"
        title={
          isLoggedIn
            ? t("tipLoggedInTpl", { limit: limitText })
            : t("tipLoggedOut")
        }
      >
        {busy
          ? t("btnSaving")
          : isLoggedIn
            ? t("btnSave")
            : t("btnLogin")}
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

      {showLoginPrompt && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowLoginPrompt(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-zinc-900 text-lg mb-2">{tPrompt("h")}</h3>
            <p className="text-sm text-zinc-700 leading-6 mb-4">{tPrompt("body")}</p>
            <ul className="text-sm text-zinc-700 space-y-1.5 mb-4 pl-5 list-disc">
              <li>{tPrompt("bullet1")}</li>
              <li>
                {tPrompt("bullet2Pre")}
                <strong>{tPrompt("bullet2Strong")}</strong>
                {tPrompt("bullet2Suffix")}
              </li>
              <li>{tPrompt("bullet3")}</li>
            </ul>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 leading-5 mb-4">
              {tPrompt("warn")}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="text-sm px-3 py-1.5 rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                {tPrompt("cancel")}
              </button>
              <a
                href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
                className="inline-flex items-center text-sm px-4 py-1.5 rounded bg-amber-700 text-white font-medium hover:bg-amber-800"
              >
                {tPrompt("loginNow")}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
