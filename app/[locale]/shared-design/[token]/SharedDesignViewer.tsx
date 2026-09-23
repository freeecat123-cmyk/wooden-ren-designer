"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { PublicDesign } from "@/lib/design-sharing/payload";

const PerspectiveView = dynamic(() => import("@/components/PerspectiveView").then(module => module.PerspectiveView), { ssr: false });

export function SharedDesignViewer({ token, english }: { token: string; english: boolean }) {
  const [publication, setPublication] = useState<PublicDesign | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let generation = 0;
    let controller: AbortController | undefined;
    let lease: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { generation++; controller?.abort(); clearTimeout(lease); setPublication(null); };
    async function refresh() {
      if (document.hidden) { clear(); return; }
      controller?.abort();
      const current = ++generation;
      const requestController = new AbortController();
      controller = requestController;
      const timeout = setTimeout(() => requestController.abort(), 10000);
      try {
        const response = await fetch(`/api/design-shares/${token}`, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: requestController.signal });
        if (!response.ok) throw new Error("unavailable");
        const payload: PublicDesign = await response.json();
        if (current !== generation) return;
        if (payload.schema !== 1 || !payload.design?.parts?.length) throw new Error("unavailable");
        setPublication(payload); setUnavailable(false);
        clearTimeout(lease);
        lease = setTimeout(() => { setPublication(null); setUnavailable(true); }, 25000);
      } catch {
        if (current === generation) { setPublication(null); setUnavailable(true); }
      } finally { clearTimeout(timeout); }
    }
    const visibility = () => { clear(); if (!document.hidden) void refresh(); };
    void refresh();
    const interval = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", visibility);
    window.addEventListener("offline", clear);
    return () => {
      clear(); clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", visibility);
      window.removeEventListener("offline", clear);
    };
  }, [token]);
  return <main className="mx-auto w-full max-w-7xl px-4 py-6" data-testid="shared-design-viewer">
    <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-xl font-semibold">{english ? "Shared design" : "分享設計"}</h1>
      <span className="text-sm text-zinc-600">{english ? "Read-only saved version" : "唯讀已儲存版本"}</span>
    </header>
    <div className="h-[65dvh] min-h-[300px] w-full" data-testid="shared-model">
      {publication ? <PerspectiveView design={publication.design} joineryMode={publication.joineryMode} compactMode />
        : <p role="status" className="py-12 text-center text-zinc-600">{unavailable
          ? (english ? "This share is unavailable or has been revoked." : "此分享無法使用或已撤銷。")
          : (english ? "Loading saved model..." : "載入已儲存模型...")}</p>}
    </div>
  </main>;
}
