"use client";

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

  useEffect(() => {
    if (isLoading) return;
    if (initialized.current !== key) {
      initialized.current = key;
      initialSearch.current = contentSearch(search);
      setRecovery(null);
      try {
        const raw = localStorage.getItem(key);
        const draft = raw ? JSON.parse(raw) as Draft : null;
        if (draft && typeof draft.search === "string" && typeof draft.savedAt === "number" && contentSearch(draft.search) !== contentSearch(search)) {
          setRecovery(draft);
        }
      } catch { setFailed(true); }
      return;
    }
    if (recovery) return;
    try {
      if (contentSearch(search) === initialSearch.current) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify({ search, savedAt: Date.now() }));
      setFailed(false);
    } catch { setFailed(true); }
  }, [key, search, isLoading, recovery]);

  useEffect(() => {
    const clear = (event: Event) => {
      const detail = (event as CustomEvent<{ search: string }>).detail;
      if (contentSearch(window.location.search) !== contentSearch(detail.search)) return;
      initialSearch.current = contentSearch(window.location.search);
      try { localStorage.removeItem(key); } catch { setFailed(true); }
      setRecovery(null);
    };
    window.addEventListener("wooden-ren:design-saved", clear);
    return () => window.removeEventListener("wooden-ren:design-saved", clear);
  }, [key]);

  if (!recovery && !failed) return null;
  return <div role="status" className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 text-sm">
    <span>{failed ? (en ? "Device recovery is unavailable." : "此裝置暫時無法備份草稿。") : (en ? "A previous device draft is available." : "找到此裝置上次的設計草稿。")}</span>
    {recovery && <>
      <button type="button" className="min-h-11 px-3 underline" onClick={() => {
        const draft = new URLSearchParams(recovery.search);
        // Keep recovery within the current design; retain the old revision for conflict detection.
        draft.delete("loadSaved");
        const id = searchParams.get("designId");
        if (id) draft.set("designId", id); else draft.delete("designId");
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
