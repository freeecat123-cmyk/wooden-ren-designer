"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";

interface Version {
  id: string;
  name: string | null;
  created_at: string;
  params: Record<string, unknown>;
  hasModelSnapshot?: boolean;
}

export function DesignVersions({ designId, revision, disabled, hasChanges }: {
  designId: string; revision?: string; disabled: boolean; hasChanges: boolean;
}) {
  const en = useLocale() === "en";
  const titleId = useId();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Version | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);

  async function load(offset: number) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/designs/${designId}/versions?offset=${offset}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("load");
      const data = await response.json();
      setVersions(previous => offset === 0 ? data.versions : [...previous, ...data.versions]);
      setHasMore(data.hasMore);
    } catch {
      if (!controller.signal.aborted) setError(en ? "Could not load history. Please retry." : "無法讀取歷史版本，請重試。");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (open) dialog.current?.showModal(); else dialog.current?.close();
  }, [open]);

  async function restore() {
    if (!selected || restoring || !revision) return;
    setRestoring(true);
    setError("");
    try {
      const response = await fetch(`/api/designs/${designId}/versions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: selected.id, expectedUpdatedAt: revision }),
      });
      if (response.status === 409) {
        const data = await response.json();
        setError(data.error === "invalid_model_snapshot"
          ? (en ? "This archived model could not be verified. Contact support; your current design has not changed." : "歷史模型驗證未通過，請聯絡管理員；目前設計未被更動。")
          : (en ? "The cloud design has changed. Reopen it before restoring." : "雲端設計已有更新，請重新開啟設計後再還原。"));
        return;
      }
      if (!response.ok) throw new Error("restore");
      // Reload through the owned-record resolver, so every view uses the restored cloud state.
      window.dispatchEvent(new CustomEvent("wooden-ren:version-restored", { detail: { id: designId } }));
      window.location.assign(`${pathname}?designId=${encodeURIComponent(designId)}&loadSaved=1`);
    } catch { setError(en ? "Restore failed. Please reload history before retrying." : "還原未完成，請重新讀取歷史版本後再試。"); }
    finally { setRestoring(false); }
  }

  return <>
    <button type="button" disabled={disabled} className="min-h-11 rounded-lg border border-zinc-300 px-3 text-xs disabled:opacity-50" onClick={() => {
      setSelected(null); setVersions([]); setOpen(true); void load(0);
    }}>{en ? "Version history" : "歷史版本"}</button>
    <dialog ref={dialog} onCancel={event => { if (restoring) event.preventDefault(); else setOpen(false); }} onClose={() => setOpen(false)}
      aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border border-zinc-300 bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/50">
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold">{en ? "Version history" : "歷史版本"}</h2>
        <button type="button" disabled={restoring} aria-label={en ? "Close" : "關閉"} className="min-h-11 min-w-11 text-xl" onClick={() => setOpen(false)}>×</button>
      </div>
      {selected ? <div className="space-y-4 pt-3">
        <p className="break-words font-medium">{selected.name}</p>
        <p className="text-sm">{[selected.params.length, selected.params.width, selected.params.height].map(v => typeof v === "number" || typeof v === "string" ? v : "?").join(" × ")} mm</p>
        <p className="text-sm text-zinc-600">{en ? "Restoring updates the cloud design. Its current saved version will remain in history." : "還原會更新雲端設計，目前已儲存的版本仍會保留在歷史紀錄。"}</p>
        <p className="text-xs text-zinc-500">{selected.hasModelSnapshot
          ? (en ? "Saved model data is preserved. Pricing and rendering use the current app." : "保留當時模型資料；價格與繪圖程式使用目前版本。")
          : (en ? "This older record contains parameters only, not its original model. Drawings use the current template." : "此舊紀錄只有參數，沒有當時模型；圖面會使用目前模板重新產生。")}</p>
        {hasChanges && <p className="text-sm text-red-700">{en ? "Your unsaved edits will be replaced. Save them first if you need to keep them." : "目前尚未儲存的修改會被取代；需要保留的話，請先取消並儲存。"}</p>}
        {!revision && <p className="text-sm text-red-700">{en ? "Reopen this design from My Designs before restoring." : "請先從我的設計重新開啟，再使用還原。"}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={restoring} className="min-h-11 px-3" onClick={() => setSelected(null)}>{en ? "Back" : "返回"}</button>
          <button type="button" disabled={restoring || !revision} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-white disabled:opacity-50" onClick={() => void restore()}>{restoring ? (en ? "Restoring…" : "還原中…") : (en ? "Restore this version" : "還原此版本")}</button>
        </div>
      </div> : <>
        <ul className="divide-y divide-zinc-200">
          {versions.map(version => <li key={version.id}><button type="button" className="w-full py-3 text-left" onClick={() => setSelected(version)}>
            <span className="block break-words font-medium">{version.name || (en ? "Untitled design" : "未命名設計")}</span>
            <span className="text-xs text-zinc-500">{en ? "Archived " : "封存於 "}{new Date(version.created_at).toLocaleString(en ? "en-US" : "zh-TW")}</span>
          </button></li>)}
        </ul>
        {!loading && !error && versions.length === 0 && <p className="py-5 text-sm text-zinc-600">{en ? "No previous versions yet." : "目前還沒有舊版本。"}</p>}
        {loading && <p role="status" className="py-3 text-sm">{en ? "Loading…" : "讀取中…"}</p>}
        {hasMore && !loading && <button type="button" className="min-h-11 underline" onClick={() => void load(versions.length)}>{en ? "Load more" : "載入更多"}</button>}
      </>}
      {error && <div role="alert" className="mt-3 text-sm text-red-700"><p>{error}</p>{!selected && <button type="button" className="min-h-11 underline" onClick={() => void load(0)}>{en ? "Retry" : "重試"}</button>}</div>}
    </dialog>
  </>;
}
