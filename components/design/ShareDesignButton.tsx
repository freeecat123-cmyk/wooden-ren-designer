"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import type { FurnitureCategory } from "@/lib/types";
import { useSavedShare } from "@/lib/design-sharing/use-saved-share";

interface Props {
  category?: FurnitureCategory;
  defaults?: { length: number; width: number; height: number };
  savedDesignId?: string | null;
  /** Exact designs.updated_at of the verified saved model currently on screen. */
  savedRevision?: string | null;
  /** Includes unsubmitted form changes, not only URL parameter changes. */
  hasUnsavedChanges?: boolean;
}
type Share = { token: string; source_revision: string };
export function ShareDesignButton({ savedDesignId: initialDesignId, savedRevision: initialRevision, hasUnsavedChanges = true }: Props) {
  const { designId: savedDesignId, revision: savedRevision, dirty } = useSavedShare(initialDesignId, initialRevision, hasUnsavedChanges);
  const en = useLocale() === "en";
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const context = `${savedDesignId}:${savedRevision}`;
  const currentContext = useRef(context);
  currentContext.current = context;
  const canPublish = Boolean(savedDesignId && savedRevision && !dirty);
  useEffect(() => { dialog.current?.close(); setShares([]); setFallbackUrl(""); setMessage(""); }, [context]);
  const errorText = (code?: string) => {
    if (code === "rate_limited") return en ? "Daily sharing limit reached. Existing links can still be revoked." : "今日建立分享次數已達上限，仍可撤銷既有連結。";
    if (code === "unauthenticated") return en ? "Sign in to manage sharing." : "請先登入再管理分享。";
    if (code === "design_conflict") return en ? "The saved design changed. Reopen it before sharing." : "雲端設計已變更，請重新開啟後再分享。";
    if (code === "signed_snapshot_required") return en ? "Save this design again to capture a verified model." : "請重新儲存設計，建立可驗證的模型版本。";
    return en ? "Sharing is unavailable. Please retry." : "分享暫時無法使用，請重試。";
  };
  async function manage(offset = 0) {
    dialog.current?.showModal(); setMessage(""); setFallbackUrl("");
    if (!savedDesignId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/design-shares?designId=${encodeURIComponent(savedDesignId)}&offset=${offset}`, { cache: "no-store" });
      const data = await response.json();
      if (currentContext.current !== context) return;
      if (!response.ok) { setMessage(errorText(data.error)); return; }
      setShares(previous => offset ? [...previous, ...data.shares.filter((share: Share) => !previous.some(existing => existing.token === share.token))] : data.shares);
      setNextOffset(data.nextOffset);
    } catch { if (currentContext.current === context) setMessage(errorText()); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!canPublish || busy) return;
    setBusy(true); setMessage(""); setFallbackUrl("");
    try {
      const response = await fetch("/api/design-shares", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: savedDesignId, expectedUpdatedAt: savedRevision }) });
      const data = await response.json();
      if (currentContext.current !== context) return;
      if (!response.ok) { setMessage(errorText(data.error)); return; }
      setShares(previous => [{ token: data.token, source_revision: data.sourceRevision }, ...previous]);
      setMessage(en ? "Read-only link created." : "已建立唯讀分享連結。");
    } catch { if (currentContext.current === context) setMessage(errorText()); }
    finally { setBusy(false); }
  }
  async function copy(token: string) {
    const url = new URL(`${en ? "/en" : ""}/shared-design/${token}`, window.location.origin).toString();
    try { await navigator.clipboard.writeText(url); setFallbackUrl(""); setMessage(en ? "Link copied." : "已複製連結。"); }
    catch { setFallbackUrl(url); setMessage(en ? "Copy the link below." : "請複製下方連結。"); }
  }
  async function revoke(token: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/design-shares/${token}`, { method: "DELETE" });
      if (currentContext.current !== context) return;
      if (!response.ok) { setMessage(errorText((await response.json()).error)); return; }
      setShares(previous => previous.filter(share => share.token !== token));
      setFallbackUrl(""); setMessage(en ? "Link revoked." : "已撤銷連結。");
    } catch { if (currentContext.current === context) setMessage(errorText()); }
    finally { setBusy(false); }
  }
  const button = "rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-zinc-100";
  return <>
    <button type="button" onClick={() => manage()} disabled={busy} className={button}>{en ? "Share design" : "分享設計"}</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] overflow-y-auto rounded-lg bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/40">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold">{en ? "Design sharing" : "設計分享"}</h2>
        <button type="button" className={button} onClick={() => dialog.current?.close()}>{en ? "Close" : "關閉"}</button>
      </div>
      <p className="my-4 text-sm text-zinc-600">{en
        ? "Anyone with the link can view this saved model. Later edits will not change it. Revocation stops future access, but cannot erase copies already made."
        : "持有連結的人可查看此已儲存模型，後續修改不會影響分享版本。撤銷可停止後續存取，但無法收回他人已保存的副本。"}</p>
      {!canPublish && <p className="mb-3 text-sm text-red-700">{en ? "Save and reopen an unchanged design before publishing." : "請先儲存並重新開啟未修改的設計，再建立分享。"}</p>}
      <button type="button" disabled={!canPublish || busy} onClick={publish} className={button}>{en ? "Publish saved version" : "發布已儲存版本"}</button>
      <ul className="mt-4 divide-y divide-zinc-200">
        {shares.map((share, index) => <li key={share.token} className="flex flex-wrap items-center gap-2 py-3">
          <span className="min-w-0 flex-1 text-sm">{en ? "Link" : "連結"} {index + 1}<time className="block break-all text-xs text-zinc-500">{share.source_revision}</time></span>
          <button type="button" disabled={busy} onClick={() => copy(share.token)} className={button}>{en ? "Copy link" : "複製連結"}</button>
          <button type="button" disabled={busy} onClick={() => revoke(share.token)} className={`${button} text-red-700`}>{en ? "Revoke" : "撤銷"}</button>
        </li>)}
      </ul>
      {nextOffset !== null && <button type="button" className={button} disabled={busy} onClick={() => manage(nextOffset)}>{en ? "Load more" : "載入更多"}</button>}
      {fallbackUrl && <input aria-label={en ? "Share URL" : "分享網址"} readOnly value={fallbackUrl} onFocus={event => event.target.select()} className="mt-3 w-full border border-zinc-300 p-2 text-sm" />}
      <p role="status" className="mt-3 text-sm">{busy ? (en ? "Please wait..." : "處理中...") : message}</p>
    </dialog>
  </>;
}
