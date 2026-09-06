"use client";

import { useEffect, useRef, useState } from "react";
import { designFingerprint } from "@/lib/design/saved-query";
import { DesignVersions } from "@/components/design/DesignVersions";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";
import { createClient } from "@/lib/supabase/client";
import { track } from "@vercel/analytics";

interface Props {
  /** 家具分類 id（pencil-holder, dovetail-box, ...） */
  furnitureType: string;
  /** 顯示用名稱（例：「筆筒 80×80×110」） */
  defaultName: string;
  /** 完整設計參數，會塞進 designs.params jsonb */
  params: Record<string, unknown>;
  /** 目前正在編輯的雲端設計 id；有 id 時「儲存設計」代表更新同一筆。 */
  currentDesignId?: string | null;
}

export function SaveDesignButton({ furnitureType, defaultName, params, currentDesignId }: Props) {
  const t = useTranslations("saveDesign");
  const tPrompt = useTranslations("saveDesign.loginPrompt");
  const { features, userId, isLoggedIn, isLoading } = useUserPlan();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeDesignId, setActiveDesignId] = useState<string | null>(currentDesignId ?? null);
  const [busy, setBusy] = useState<"save" | "saveAs" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const fingerprint = designFingerprint(params);
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
  const revisionRef = useRef(searchParams?.get("revision") ?? undefined);
  const inFlight = useRef(false);
  const completedSave = useRef<{ id: string; fingerprint: string } | null>(null);
  const editingContext = `${pathname}:${currentDesignId ?? "new"}`;
  const contextRef = useRef(editingContext);
  contextRef.current = editingContext;
  const hasChanges = savedFingerprint !== fingerprint;
  const dirty = !activeDesignId || hasChanges;

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; fingerprint: string; revision?: string }>).detail;
      completedSave.current = detail;
      setActiveDesignId(detail.id);
      setSavedFingerprint(detail.fingerprint);
      revisionRef.current = detail.revision;
    };
    window.addEventListener("wooden-ren:design-saved", sync);
    return () => window.removeEventListener("wooden-ren:design-saved", sync);
  }, []);

  const markSaved = (id: string) => {
    window.dispatchEvent(new CustomEvent("wooden-ren:design-saved", { detail: { id, fingerprint, revision: revisionRef.current, search: searchParams.toString() } }));
  };

  useEffect(() => {
    revisionRef.current = searchParams?.get("revision") ?? revisionRef.current;
  }, [searchParams]);

  useEffect(() => {
    setActiveDesignId(currentDesignId ?? null);
    revisionRef.current = searchParams?.get("revision") ?? undefined;
    setSavedFingerprint(completedSave.current && completedSave.current.id === currentDesignId ? completedSave.current.fingerprint : fingerprint);
    setMsg(null);
    // Reset the baseline only when switching designs, not while editing parameters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDesignId]);

  useEffect(() => {
    if (!hasChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    const restored = (event: Event) => {
      if ((event as CustomEvent<{ id: string }>).detail.id === activeDesignId) window.removeEventListener("beforeunload", warn);
    };
    window.addEventListener("wooden-ren:version-restored", restored);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("wooden-ren:version-restored", restored); };
  }, [hasChanges, activeDesignId]);

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

  const handleCreate = async (requestContext: string) => {
    const supabase = createClient();
    const { count: typeCount } = await supabase
      .from("designs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("furniture_type", furnitureType);
    const nextSerial = (typeCount ?? 0) + 1;
    if (contextRef.current !== requestContext) return null;
    const padded = String(nextSerial).padStart(3, "0");
    const suggestedName = `${defaultName} #${padded}`;
    const name = window.prompt(t("promptName"), suggestedName);
    if (name === null) return null;
    const finalName = name.trim() || suggestedName;

    const res = await fetch("/api/designs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ furnitureType, name: finalName, params }),
    });
    const json = (await res.json()) as {
      id?: string;
      updated_at?: string;
      error?: string;
      message?: string;
      max?: number;
      count?: number;
    };
    if (!res.ok) {
      if (json.error === "max_designs_reached") {
        const max = json.max ?? features.maxDesigns;
        const count = json.count ?? 0;
        setMsg({
          kind: "warn",
          text: t("warnMaxDesignsTpl", { max, count }),
        });
        return null;
      }
      if (json.error === "plan_locked_category") {
        setMsg({
          kind: "warn",
          text: json.message ?? t("warnPlanLockedFallback"),
        });
        return null;
      }
      if (json.error === "unauthenticated") {
        setMsg({ kind: "warn", text: t("warnUnauth") });
        return null;
      }
      throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
    }
    if (contextRef.current !== requestContext) return null;
    if (json.id) {
      revisionRef.current = json.updated_at;
      track("design_saved", { furnitureType });
    }
    return json.id ?? null;
  };

  const attachDesignIdToUrl = (id: string) => {
    const next = new URLSearchParams(window.location.search);
    next.set("designId", id);
    if (revisionRef.current) next.set("revision", revisionRef.current);
    const qs = next.toString();
    router.replace(qs ? `${pathname ?? ""}?${qs}` : (pathname ?? ""), { scroll: false });
  };

  const handleSave = async () => {
    if (inFlight.current) return;
    setMsg(null);
    if (!isLoggedIn || !userId) {
      setShowLoginPrompt(true);
      return;
    }

    // Only skip a repeat confirmed by this editor's successful save response.
    // An initial URL alone is not proof that its parameters match the cloud.
    if (activeDesignId && completedSave.current?.id === activeDesignId && completedSave.current.fingerprint === fingerprint) {
      setMsg({ kind: "ok", text: t("okUpdated") });
      return;
    }

    inFlight.current = true;
    const requestContext = contextRef.current;
    setBusy("save");
    try {
      if (!activeDesignId) {
        const id = await handleCreate(requestContext);
        if (!id) return;
        setActiveDesignId(id);
        attachDesignIdToUrl(id);
        markSaved(id);
        setMsg({ kind: "ok", text: t("okSaved") });
        return;
      }

      if (!revisionRef.current) {
        setMsg({ kind: "warn", text: t("conflict") });
        return;
      }
      const res = await fetch(`/api/designs/${activeDesignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ furnitureType, params, expectedUpdatedAt: revisionRef.current }),
      });
      const json = (await res.json()) as { error?: string; message?: string; updated_at?: string };
      if (contextRef.current !== requestContext) return;
      if (!res.ok) {
        if (json.error === "design_conflict") {
          setMsg({ kind: "warn", text: t("conflict") });
          return;
        }
        if (json.error === "unauthenticated") {
          setMsg({ kind: "warn", text: t("warnUnauth") });
          return;
        }
        throw new Error(json.message ?? json.error ?? `HTTP ${res.status}`);
      }

      revisionRef.current = json.updated_at;
      attachDesignIdToUrl(activeDesignId);
      markSaved(activeDesignId);
      setMsg({ kind: "ok", text: t("okUpdated") });
    } catch (e) {
      setMsg({
        kind: "err",
        text: t("errSaveFailTpl", { msg: e instanceof Error ? e.message : String(e) }),
      });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const handleSaveAs = async () => {
    if (inFlight.current) return;
    setMsg(null);
    if (!isLoggedIn || !userId) {
      setShowLoginPrompt(true);
      return;
    }

    inFlight.current = true;
    const requestContext = contextRef.current;
    setBusy("saveAs");
    try {
      const id = await handleCreate(requestContext);
      if (!id) return;
      setActiveDesignId(id);
      attachDesignIdToUrl(id);
      markSaved(id);
      setMsg({ kind: "ok", text: t("okSavedAs") });
    } catch (e) {
      setMsg({
        kind: "err",
        text: t("errSaveFailTpl", { msg: e instanceof Error ? e.message : String(e) }),
      });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const limitText =
    features.maxDesigns === Infinity
      ? t("tipLimitUnlimited")
      : t("tipLimitNTpl", { n: features.maxDesigns });

  return (
    <div className="inline-flex min-w-0 flex-col items-end gap-1 max-md:col-span-2 max-md:w-full">
      <div className="inline-flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy !== null}
          className="max-md:min-h-[44px] inline-flex items-center gap-1 px-3.5 py-2 bg-amber-700 text-white rounded-lg text-xs font-medium shadow-sm shadow-amber-900/20 hover:bg-amber-800 hover:shadow-md transition-all disabled:opacity-50"
          title={
            isLoggedIn
              ? t("tipLoggedInTpl", { limit: limitText })
              : t("tipLoggedOut")
          }
        >
          {busy === "save"
            ? t("btnSaving")
            : isLoggedIn
              ? t("btnSave")
              : t("btnLogin")}
        </button>
        {isLoggedIn && activeDesignId && (
          <button
            type="button"
            onClick={handleSaveAs}
            disabled={busy !== null}
            className="max-md:min-h-[44px] inline-flex items-center gap-1 px-3 py-2 bg-white text-amber-800 rounded-lg text-xs font-medium border border-amber-300 hover:bg-amber-50 transition-all disabled:opacity-50"
            title={t("tipSaveAs")}
          >
            {busy === "saveAs" ? t("btnSaving") : t("btnSaveAs")}
          </button>
        )}
      </div>
      {isLoggedIn && activeDesignId && <DesignVersions key={activeDesignId} designId={activeDesignId} revision={revisionRef.current} disabled={busy !== null} hasChanges={hasChanges} />}
      <p role="status" aria-live="polite" className="text-xs text-zinc-600">
        {busy ? t("btnSaving") : dirty ? t("unsaved") : t("saved")}
      </p>
      {msg && !(msg.kind === "ok" && dirty) && (
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
