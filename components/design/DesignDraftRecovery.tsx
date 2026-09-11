"use client";
import { announceDesignNavigation } from "@/lib/design/navigation-pending";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useUserPlan } from "@/hooks/useUserPlan";

interface Draft { search: string; savedAt: number }
function contentSearch(search: string) {
  const query = new URLSearchParams(search);
  query.delete("revision");
  query.delete("designId");
  query.sort();
  return query.toString();
}

export function DesignDraftRecovery() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const en = locale === "en";
  const { userId, isLoading } = useUserPlan();
  const search = searchParams.toString();
  const key = `wooden-ren:draft:v1:${userId ?? "guest"}:${pathname}:${searchParams.get("designId") ?? "new"}`;
  const initialized = useRef("");
  const initialSearch = useRef(contentSearch(search));
  const [recovery, setRecovery] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  const [backedUpAt, setBackedUpAt] = useState<number | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (initialized.current !== key) {
      initialized.current = key;
      initialSearch.current = contentSearch(search);
      setRecovery(null);
      setBackedUpAt(null);
      try {
        const raw = localStorage.getItem(key);
        const draft = raw ? JSON.parse(raw) as Draft : null;
        if (draft && typeof draft.search === "string" && typeof draft.savedAt === "number" && Number.isFinite(new Date(draft.savedAt).getTime()) && contentSearch(draft.search) !== contentSearch(search)) {
          setRecovery(draft);
        }
      } catch { setFailed(true); }
      return;
    }
    if (recovery) return;
    try {
      if (contentSearch(search) === initialSearch.current) {
        localStorage.removeItem(key);
        setBackedUpAt(null);
      } else {
        const savedAt = Date.now();
        localStorage.setItem(key, JSON.stringify({ search, savedAt }));
        setBackedUpAt(savedAt);
      }
      setFailed(false);
    } catch { setFailed(true); }
  }, [key, search, isLoading, recovery]);

  useEffect(() => {
    const clear = (event: Event) => {
      const detail = (event as CustomEvent<{ search: string }>).detail;
      const savedId = new URLSearchParams(detail.search).get("designId");
      const currentId = new URLSearchParams(window.location.search).get("designId");
      if (savedId && currentId && savedId !== currentId) return;
      // The cloud baseline advances even when newer edits remain on screen.
      initialSearch.current = contentSearch(detail.search);
      if (contentSearch(window.location.search) !== contentSearch(detail.search)) return;
      try { localStorage.removeItem(key); } catch { setFailed(true); }
      setRecovery(null);
      setBackedUpAt(null);
    };
    window.addEventListener("wooden-ren:design-saved", clear);
    return () => window.removeEventListener("wooden-ren:design-saved", clear);
  }, [key]);

  if (!recovery && !failed && !backedUpAt) return null;
  return <div role="status" className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 text-sm">
    <span>{failed ? (en ? "Device recovery is unavailable." : "此裝置暫時無法備份草稿。") : recovery
      ? (en ? "A previous device draft is available." : "找到此裝置上次的設計草稿。")
      : (en ? "Draft backed up on this device only" : "草稿已備份在此裝置，尚未同步至雲端")}
      {!failed && (recovery?.savedAt ?? backedUpAt) && <time className="ml-2" dateTime={new Date((recovery?.savedAt ?? backedUpAt)!).toISOString()}>{new Date((recovery?.savedAt ?? backedUpAt)!).toLocaleTimeString(locale)}</time>}
    </span>
    {recovery && <>
      <button type="button" className="min-h-11 px-3 underline" onClick={() => {
        const draft = new URLSearchParams(recovery.search);
        // Keep recovery within the current design; retain the old revision for conflict detection.
        draft.delete("loadSaved");
        const id = searchParams.get("designId");
        if (id) draft.set("designId", id); else draft.delete("designId");
        announceDesignNavigation(`${pathname}?${draft}`);
        router.replace(`${pathname}?${draft}`, { scroll: false });
        setRecovery(null);
      }}>{en ? "Restore draft" : "恢復草稿"}</button>
      <button type="button" className="min-h-11 px-3" onClick={() => {
        try { localStorage.removeItem(key); } catch { setFailed(true); }
        setRecovery(null);
      }}>{en ? "Discard" : "捨棄草稿"}</button>
    </>}
  </div>;
}
